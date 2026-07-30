#!/usr/bin/env node
// aplicar-migrations.mjs — runner de migrations Supabase.
//
// Lê supabase/migrations/*.sql em ordem alfabética (== ordem cronológica
// dos timestamps) e aplica no banco alvo via Management API. Registra
// cada uma em public.schema_migrations, e pula as já registradas.
//
// Uso:
//   node scripts/aplicar-migrations.mjs --ref <project_ref>       # aplica pendentes
//   node scripts/aplicar-migrations.mjs --ref <project_ref> --dry # só mostra o que faria
//
// Requer SUPABASE_ACCESS_TOKEN no .env.local (raiz).
//
// Idempotente: rodar 2x seguidas não reaplica nada. As próprias
// migrations também são idempotentes (create/alter if not exists,
// drop policy if exists + create policy, create or replace function).

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MIGR_DIR = resolve(ROOT, 'supabase', 'migrations')

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

async function runQuery(ref, sql, attempt = 1) {
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    // 500 (OOM), 502/503/504 (gateway), 429 (rate limit) → retry com backoff
    const retryable = [429, 500, 502, 503, 504].includes(res.status)
    if (retryable && attempt < 6) {
      const wait = 1000 * Math.pow(2, attempt - 1)
      process.stderr.write(`   [HTTP ${res.status}, retry em ${wait / 1000}s] `)
      await sleep(wait)
      return runQuery(ref, sql, attempt + 1)
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  try { return JSON.parse(text) } catch { return text }
}

function listMigrations() {
  return readdirSync(MIGR_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // ordem alfabética == timestamp
    .map((f) => ({
      versao: f.replace(/\.sql$/, ''),
      arquivo: f,
      caminho: join(MIGR_DIR, f),
    }))
}

async function getAplicadas(ref) {
  // Garante que a tabela existe antes de consultar (a 000000 é
  // exatamente essa criação). Se ainda não existe, é banco novo.
  try {
    const rows = await runQuery(ref, 'select versao from public.schema_migrations order by versao')
    const arr = Array.isArray(rows) ? rows : (rows.result ?? rows.data ?? [])
    return new Set(arr.map((r) => r.versao))
  } catch (e) {
    // Postgres 42P01 = undefined_table. Banco novo ainda não tem
    // schema_migrations — devolve set vazio pra rodar tudo.
    const msg = String(e.message || '')
    if (msg.includes('42P01') || msg.includes('does not exist')) {
      return new Set()
    }
    throw e
  }
}

async function aplicar(ref, opts) {
  const migrations = listMigrations()
  console.log(`\n📁 ${migrations.length} migrations no repositório`)

  const aplicadas = await getAplicadas(ref)
  console.log(`✅ ${aplicadas.size} já aplicadas no banco ${ref}`)

  const pendentes = migrations.filter((m) => !aplicadas.has(m.versao))
  console.log(`⏳ ${pendentes.length} pendentes\n`)

  if (opts.dry) {
    for (const m of pendentes) console.log(`   [dry] aplicaria: ${m.arquivo}`)
    console.log(`\nDRY-RUN — nada foi aplicado.`)
    return { aplicadas: 0, falharam: 0 }
  }

  if (!pendentes.length) {
    console.log('Nada a fazer — banco já está no head.')
    return { aplicadas: 0, falharam: 0 }
  }

  let ok = 0, fail = 0
  for (const m of pendentes) {
    process.stdout.write(`▶ ${m.arquivo}... `)
    const sql = readFileSync(m.caminho, 'utf8')
    try {
      await runQuery(ref, sql)
      await runQuery(
        ref,
        `insert into public.schema_migrations (versao) values ('${m.versao.replace(/'/g, "''")}')
         on conflict (versao) do nothing`,
      )
      console.log(`OK`)
      ok++
      // pequena folga pra não bater OOM do Redis da Mgmt API
      await sleep(300)
    } catch (e) {
      console.log(`❌ FALHOU`)
      console.error(`   ${e.message}`)
      fail++
      // não segue: uma migration que falhou pode deixar schema inconsistente
      break
    }
  }
  return { aplicadas: ok, falharam: fail }
}

async function main() {
  loadEnv()
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('SUPABASE_ACCESS_TOKEN ausente em .env.local')
    process.exit(1)
  }
  const args = process.argv.slice(2)
  const refIdx = args.indexOf('--ref')
  const ref = refIdx >= 0 ? args[refIdx + 1] : null
  const dry = args.includes('--dry') || args.includes('--dry-run')

  if (!ref) {
    console.error('Uso: node scripts/aplicar-migrations.mjs --ref <project_ref> [--dry]')
    process.exit(1)
  }

  const { aplicadas, falharam } = await aplicar(ref, { dry })
  console.log(`\n=== Resumo: aplicadas=${aplicadas} falharam=${falharam} ===`)
  process.exit(falharam ? 1 : 0)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
