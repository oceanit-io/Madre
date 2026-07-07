#!/usr/bin/env node
// provisionar-cliente.mjs — provisiona a stack inteira de um cliente novo:
//   Supabase (novo projeto + migrations) + Vercel (novo projeto + envs +
//   subdomínio) + registro em scripts/instancias.json.
//
// Uso:
//   node scripts/provisionar-cliente.mjs --slug lunara --nome "Lunara Joias"
//     [--dry-run]      só imprime o plano, não cria nada
//     [--yes]          pula confirmações interativas (perigoso)
//     [--plan=free|pro]  plano Supabase (default: free)
//
// Requer no .env.local:
//   SUPABASE_ACCESS_TOKEN  (Personal Access Token da Supabase)
//   VERCEL_TOKEN           (Personal Access Token da Vercel)
//
// Constantes hard-codadas (mudam raramente):
//   SUPABASE_ORG_ID = organização Supabase da Madre
//   VERCEL_TEAM_ID  = team Vercel "gabbweb's projects"
//   GITHUB_REPO     = repositório do código (source of truth)
//
// Segurança:
//   - Segredos (service_role, PINs) NUNCA são impressos em log.
//   - Todos são gravados numa pasta local _local/creds/<slug>/ pro caso
//     do script falhar no meio — sem essa cópia, dá pra perder acesso.
//   - Nada é commitado pelo script.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------
const SUPABASE_ORG_ID = 'ladpyqylptspsxwioihf'
const VERCEL_TEAM_ID = 'team_qtcKFgr7GXv6gUsRtmhMtpZx'
const GITHUB_REPO = 'oceanit-io/Madre'
const PRODUCTION_BRANCH = 'main'
const SUPABASE_REGION = 'sa-east-1'
const DOMAIN_ROOT = 'lojadeprata925.com.br'
const INSTANCIAS_PATH = resolve(ROOT, 'scripts', 'instancias.json')
const CREDS_DIR = resolve(ROOT, '_local', 'creds')

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) throw new Error(`.env.local não encontrado em ${envPath}`)
  const txt = readFileSync(envPath, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const [, k, v] = m
    if (!process.env[k]) process.env[k] = v.trim().replace(/^["']|["']$/g, '')
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function randomPin(len = 24) {
  // hex é 0-9 a-f, alfabeto seguro pra URL/cookie sem escape
  return randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

function isValidSlug(s) {
  return /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/.test(s)
}

const INTERACTIVE = process.stdin.isTTY === true

async function ask(rl, question, defaultVal = '') {
  if (!INTERACTIVE) {
    // Sem TTY (pipe / CI): usa default direto pra não travar.
    console.log(`${question} [${defaultVal}] → (default, non-interactive)`)
    return defaultVal
  }
  const q = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `
  const answer = (await rl.question(q)).trim()
  return answer || defaultVal
}

async function confirm(rl, question) {
  if (!INTERACTIVE) {
    // Sem TTY: precisa de --yes explícito pra prosseguir; senão nega.
    console.log(`${question} [não-interativo, precisa --yes]`)
    return false
  }
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes' || answer === 's' || answer === 'sim'
}

// -----------------------------------------------------------------------------
// HTTP com retry pra 429/5xx
// -----------------------------------------------------------------------------
async function req(url, opts, attempt = 1) {
  const res = await fetch(url, opts)
  const text = await res.text()
  if (!res.ok) {
    const retryable = [429, 500, 502, 503, 504].includes(res.status)
    if (retryable && attempt < 6) {
      const wait = 1000 * Math.pow(2, attempt - 1)
      process.stderr.write(`   [HTTP ${res.status}, retry em ${wait / 1000}s] `)
      await sleep(wait)
      return req(url, opts, attempt + 1)
    }
    const err = new Error(`HTTP ${res.status} em ${url}: ${text.slice(0, 400)}`)
    err.status = res.status
    err.body = text
    throw err
  }
  try { return JSON.parse(text) } catch { return text }
}

// -----------------------------------------------------------------------------
// Supabase Management API
// -----------------------------------------------------------------------------
const SB_BASE = 'https://api.supabase.com'
function sbHeaders() {
  return {
    Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

async function supabaseCreateProject({ name, dbPass, plan }) {
  return req(`${SB_BASE}/v1/projects`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({
      name,
      organization_id: SUPABASE_ORG_ID,
      plan,
      region: SUPABASE_REGION,
      db_pass: dbPass,
    }),
  })
}

async function supabaseGetProject(ref) {
  return req(`${SB_BASE}/v1/projects/${ref}`, { headers: sbHeaders() })
}

async function supabaseWaitHealthy(ref, timeoutMs = 6 * 60 * 1000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const p = await supabaseGetProject(ref)
    if (p.status === 'ACTIVE_HEALTHY') return p
    process.stdout.write(`.`)
    await sleep(10_000)
  }
  throw new Error(`Timeout aguardando ACTIVE_HEALTHY (>${timeoutMs / 1000}s)`)
}

async function supabaseGetApiKeys(ref) {
  // Endpoint que revela anon e service_role keys do projeto.
  return req(`${SB_BASE}/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: sbHeaders(),
  })
}

// -----------------------------------------------------------------------------
// Vercel API
// -----------------------------------------------------------------------------
const VC_BASE = 'https://api.vercel.com'
function vcHeaders() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  }
}
const vcTeamQuery = `teamId=${VERCEL_TEAM_ID}`

async function vercelCreateProject({ name }) {
  return req(`${VC_BASE}/v10/projects?${vcTeamQuery}`, {
    method: 'POST',
    headers: vcHeaders(),
    body: JSON.stringify({
      name,
      framework: 'nextjs',
      gitRepository: { type: 'github', repo: GITHUB_REPO },
      publicSource: false,
      // production branch é definida pelo repo (main)
    }),
  })
}

async function vercelSetEnv(projectId, entries) {
  // POST em lote — a API aceita array.
  const body = entries.map((e) => ({
    key: e.key,
    value: e.value,
    type: e.secret ? 'encrypted' : 'plain',
    target: e.target ?? ['production', 'preview', 'development'],
  }))
  return req(`${VC_BASE}/v10/projects/${projectId}/env?${vcTeamQuery}`, {
    method: 'POST',
    headers: vcHeaders(),
    body: JSON.stringify(body),
  })
}

async function vercelAddDomain(projectId, domain) {
  return req(`${VC_BASE}/v10/projects/${projectId}/domains?${vcTeamQuery}`, {
    method: 'POST',
    headers: vcHeaders(),
    body: JSON.stringify({ name: domain }),
  })
}

// -----------------------------------------------------------------------------
// Runner de migrations — spawn do outro script
// -----------------------------------------------------------------------------
async function aplicarMigrations(ref) {
  return new Promise((res, rej) => {
    const p = spawn(
      process.execPath,
      [resolve(__dirname, 'aplicar-migrations.mjs'), '--ref', ref],
      { stdio: 'inherit' },
    )
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`aplicar-migrations exit=${code}`))))
    p.on('error', rej)
  })
}

// -----------------------------------------------------------------------------
// Registro em scripts/instancias.json
// -----------------------------------------------------------------------------
function readInstancias() {
  if (!existsSync(INSTANCIAS_PATH)) return []
  return JSON.parse(readFileSync(INSTANCIAS_PATH, 'utf8'))
}

function writeInstancias(arr) {
  writeFileSync(INSTANCIAS_PATH, JSON.stringify(arr, null, 2) + '\n')
}

function saveCreds(slug, data) {
  const dir = resolve(CREDS_DIR, slug)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'credenciais.json'), JSON.stringify(data, null, 2))
  return dir
}

// -----------------------------------------------------------------------------
// Fluxo principal
// -----------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2)
  const out = { dryRun: false, yes: false, plan: 'free' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--slug') out.slug = args[++i]
    else if (a === '--nome') out.nome = args[++i]
    else if (a === '--dry-run' || a === '--dry') out.dryRun = true
    else if (a === '--yes' || a === '-y') out.yes = true
    else if (a.startsWith('--plan=')) out.plan = a.slice('--plan='.length)
    else if (a === '--plan') out.plan = args[++i]
  }
  return out
}

async function main() {
  loadEnv()
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN ausente em .env.local')
  if (!process.env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN ausente em .env.local')

  const opts = parseArgs()
  if (!opts.slug) throw new Error('faltou --slug <nome-curto-do-cliente>')
  if (!opts.nome) throw new Error('faltou --nome "Nome Comercial do Cliente"')
  if (!isValidSlug(opts.slug)) throw new Error(`slug inválido: ${opts.slug} (só a-z0-9-, começa com letra, 3-32 chars)`)
  if (!['free', 'pro'].includes(opts.plan)) throw new Error(`--plan deve ser free ou pro (recebi: ${opts.plan})`)

  const instancias = readInstancias()
  if (instancias.some((i) => i.slug === opts.slug)) {
    throw new Error(`slug "${opts.slug}" já existe em instancias.json`)
  }

  const nomeSupabase = `Madre-${opts.slug}`
  const nomeVercel = `Madre-${opts.slug}`
  const dominio = `${opts.slug}.${DOMAIN_ROOT}`
  const appUrl = `https://${dominio}`

  // -------------------- Prompts interativos --------------------
  const rl = createInterface({ input, output })
  let brand
  try {
    console.log(`\nProvisionamento de cliente "${opts.nome}" (slug=${opts.slug})`)
    console.log('Vou perguntar o mínimo pra montar as envs de marca. Pressione Enter pra usar o default entre colchetes.\n')
    brand = {
      nome: await ask(rl, 'NEXT_PUBLIC_BRAND_NOME', opts.nome),
      logoPrefixo: await ask(rl, 'NEXT_PUBLIC_BRAND_LOGO_PREFIXO', opts.nome.split(' ')[0] || opts.nome),
      logoDestaque: await ask(rl, 'NEXT_PUBLIC_BRAND_LOGO_DESTAQUE', opts.nome.split(' ').slice(1).join(' ')),
      cor: await ask(rl, 'NEXT_PUBLIC_BRAND_COR (hex)', '#7C5CFF'),
      fornecedor: await ask(rl, 'NEXT_PUBLIC_BRAND_FORNECEDOR', ''),
      operadora: await ask(rl, 'NEXT_PUBLIC_BRAND_OPERADORA', 'Ocean IT'),
      dominio: await ask(rl, 'NEXT_PUBLIC_BRAND_DOMINIO (sem https)', dominio),
      catalogo: await ask(rl, 'NEXT_PUBLIC_BRAND_CATALOGO (tray|manual)', 'manual'),
    }
  } finally {
    // fecha o readline temporariamente pro plano ser lido; reabre pra confirmação
  }

  const adminPinMaster = randomPin(24)
  const adminCookieSecret = randomPin(32)
  const dbPass = randomPin(24)

  // -------------------- Plano de execução --------------------
  console.log('\n===================================================================')
  console.log(`  PLANO DE EXECUÇÃO — cliente: ${opts.nome} (slug=${opts.slug})`)
  console.log('===================================================================')
  console.log(`  ${opts.dryRun ? '(DRY-RUN, nada será criado)' : ''}`)
  console.log('\n1) Supabase (Management API)')
  console.log(`   • CRIAR projeto "${nomeSupabase}" na org "${SUPABASE_ORG_ID}"`)
  console.log(`   • Plano: ${opts.plan}  ${opts.plan === 'pro' ? '⚠️  COBRA ~$25/mês' : '(free, sujeito a pausa por inatividade)'}`)
  console.log(`   • Região: ${SUPABASE_REGION}`)
  console.log(`   • Aguardar ficar ACTIVE_HEALTHY (~1-3 min)`)
  console.log(`   • Aplicar 44 migrations do repo (scripts/aplicar-migrations.mjs)`)
  console.log('\n2) Vercel (REST API)')
  console.log(`   • CRIAR projeto "${nomeVercel}" na team "gabbweb's projects"`)
  console.log(`   • Conectar ao repo ${GITHUB_REPO} (production branch = ${PRODUCTION_BRANCH})`)
  console.log(`   • Setar envs (Production/Preview/Development):`)
  console.log(`       - NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (do projeto criado no passo 1)`)
  console.log(`       - APP_URL, NEXT_PUBLIC_APP_URL = ${appUrl}`)
  console.log(`       - NEXT_PUBLIC_BRAND_* (${Object.keys(brand).length} chaves)`)
  console.log(`       - ADMIN_PIN (24 chars aleatórios) + ADMIN_COOKIE_SECRET (32 chars)`)
  console.log(`   • Adicionar domínio ${dominio} ao projeto`)
  console.log('\n3) Registro local')
  console.log(`   • Gravar entry em scripts/instancias.json`)
  console.log(`   • Copiar todas as credenciais pra _local/creds/${opts.slug}/credenciais.json (fora do git)`)
  console.log('\nENVs que ficarão VAZIAS (você preenche depois no painel Vercel):')
  console.log('   PAGARME_SECRET_KEY, PAGARME_MAIN_RECIPIENT_ID, PAGARME_PRATA15_RECIPIENT_ID,')
  console.log('   PAGARME_WEBHOOK_USER/PASS, INFINITEPAY_WEBHOOK_TOKEN,')
  console.log('   CORREIOS_USUARIO/SENHA/CONTRATO/CARTAO_POSTAGEM/DR/CEP_ORIGEM/PAC_CODIGO/SEDEX_CODIGO,')
  console.log('   RESEND_API_KEY, EMAIL_FROM.')
  console.log('\n===================================================================\n')

  if (opts.dryRun) {
    console.log('DRY-RUN — nada foi criado. Rode sem --dry-run pra executar.')
    rl.close()
    return
  }

  if (!opts.yes) {
    const ok = await confirm(rl, 'Prosseguir e criar os recursos acima?')
    if (!ok) {
      console.log('Cancelado pelo usuário.')
      rl.close()
      return
    }
  }
  rl.close()

  // -------------------- Execução --------------------
  console.log('\n▶ 1/6  Criando projeto Supabase...')
  const sbProj = await supabaseCreateProject({
    name: nomeSupabase,
    dbPass,
    plan: opts.plan,
  })
  const ref = sbProj.ref || sbProj.id
  console.log(`   ref = ${ref}`)
  // salva as credenciais o quanto antes, caso o script falhe adiante
  saveCreds(opts.slug, {
    slug: opts.slug,
    nome: opts.nome,
    supabaseRef: ref,
    supabaseDbPass: dbPass,
    adminPinMaster,
    adminCookieSecret,
    criadoEm: new Date().toISOString(),
  })
  console.log(`   credenciais parciais salvas em _local/creds/${opts.slug}/`)

  console.log('\n▶ 2/6  Aguardando Supabase ficar ACTIVE_HEALTHY (leva 1-3 min)...')
  await supabaseWaitHealthy(ref)
  console.log(' pronto')

  console.log('\n▶ 3/6  Aplicando 44 migrations no banco novo...')
  await aplicarMigrations(ref)

  console.log('\n▶ 4/6  Pegando API keys do Supabase...')
  const keys = await supabaseGetApiKeys(ref)
  const anonKey = (keys.find?.((k) => k.name === 'anon') || {}).api_key
    || (Array.isArray(keys) ? keys.find((k) => k.name === 'anon')?.api_key : null)
  const serviceRoleKey = (keys.find?.((k) => k.name === 'service_role') || {}).api_key
    || (Array.isArray(keys) ? keys.find((k) => k.name === 'service_role')?.api_key : null)
  if (!anonKey || !serviceRoleKey) throw new Error(`Não achei anon/service_role em ${JSON.stringify(keys).slice(0, 300)}`)
  const supabaseUrl = `https://${ref}.supabase.co`

  // atualiza o arquivo de credenciais com as keys
  saveCreds(opts.slug, {
    slug: opts.slug,
    nome: opts.nome,
    supabaseRef: ref,
    supabaseUrl,
    supabaseAnonKey: anonKey,
    supabaseServiceRoleKey: serviceRoleKey,
    supabaseDbPass: dbPass,
    adminPinMaster,
    adminCookieSecret,
    criadoEm: new Date().toISOString(),
  })

  console.log('\n▶ 5/6  Criando projeto Vercel...')
  const vcProj = await vercelCreateProject({ name: nomeVercel })
  const vcProjId = vcProj.id
  console.log(`   projectId = ${vcProjId}`)

  console.log(`   setando envs...`)
  await vercelSetEnv(vcProjId, [
    // Supabase
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: anonKey, secret: true },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: serviceRoleKey, secret: true },
    // App
    { key: 'APP_URL', value: appUrl },
    { key: 'NEXT_PUBLIC_APP_URL', value: appUrl },
    // Marca
    { key: 'NEXT_PUBLIC_BRAND_NOME', value: brand.nome },
    { key: 'NEXT_PUBLIC_BRAND_LOGO_PREFIXO', value: brand.logoPrefixo },
    { key: 'NEXT_PUBLIC_BRAND_LOGO_DESTAQUE', value: brand.logoDestaque },
    { key: 'NEXT_PUBLIC_BRAND_COR', value: brand.cor },
    { key: 'NEXT_PUBLIC_BRAND_FORNECEDOR', value: brand.fornecedor },
    { key: 'NEXT_PUBLIC_BRAND_OPERADORA', value: brand.operadora },
    { key: 'NEXT_PUBLIC_BRAND_DOMINIO', value: brand.dominio },
    { key: 'NEXT_PUBLIC_BRAND_CATALOGO', value: brand.catalogo },
    // Admin
    { key: 'ADMIN_PIN', value: adminPinMaster, secret: true },
    { key: 'ADMIN_COOKIE_SECRET', value: adminCookieSecret, secret: true },
  ])
  console.log(`   envs setadas.`)

  console.log(`   adicionando domínio ${dominio}...`)
  try {
    await vercelAddDomain(vcProjId, dominio)
    console.log(`   domínio adicionado.`)
  } catch (e) {
    console.log(`   ⚠️ falha ao adicionar domínio (${e.message.slice(0, 100)}). Adicione manualmente pelo painel Vercel.`)
  }

  console.log('\n▶ 6/6  Registrando em scripts/instancias.json...')
  instancias.push({
    slug: opts.slug,
    nome: opts.nome,
    supabaseRef: ref,
    vercelProject: nomeVercel,
    vercelProjectId: vcProjId,
    dominio,
    env: opts.plan === 'pro' ? 'prod' : 'test',
    criadoEm: new Date().toISOString(),
  })
  writeInstancias(instancias)

  // -------------------- Relatório final --------------------
  const credsDir = resolve(CREDS_DIR, opts.slug)
  console.log('\n===================================================================')
  console.log(`  ✅ CLIENTE PROVISIONADO: ${opts.nome} (${opts.slug})`)
  console.log('===================================================================')
  console.log(`  Supabase ref:    ${ref}`)
  console.log(`  Supabase URL:    ${supabaseUrl}`)
  console.log(`  Vercel project:  ${nomeVercel} (id=${vcProjId})`)
  console.log(`  Domínio:         ${dominio}`)
  console.log(`  Credenciais:     ${credsDir}/credenciais.json  (GUARDE!)`)
  console.log('\n📋 CHECKLIST DO QUE FALTA MANUAL:')
  console.log('   1. Verificar domínio no Resend (Settings → Domains).')
  console.log('   2. Setar envs de pagamento na Vercel (PAGARME_*, INFINITEPAY_WEBHOOK_TOKEN).')
  console.log('   3. Setar envs de frete na Vercel (CORREIOS_*).')
  console.log('   4. Setar envs de e-mail na Vercel (RESEND_API_KEY, EMAIL_FROM).')
  console.log(`   5. Apontar CNAME de "${dominio}" pra cname.vercel-dns.com (se ainda não).`)
  console.log(`   6. Criar recipient Pagar.me da conta mãe do cliente e setar PAGARME_MAIN_RECIPIENT_ID.`)
  console.log('   7. Fazer o cliente cadastrar a primeira revendedora pra confirmar RLS + trigger.')
  console.log('\n===================================================================\n')
}

main().catch((e) => {
  console.error('\n❌ FALHA:', e.message)
  if (e.body) console.error('   corpo:', e.body.slice(0, 500))
  process.exit(1)
})
