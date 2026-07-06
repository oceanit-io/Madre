#!/usr/bin/env node
// dump-schema.mjs — extrai schema real de projetos Supabase via Management API.
//
// Uso:
//   node scripts/dump-schema.mjs                 # todos os refs em REFS abaixo
//   node scripts/dump-schema.mjs --ref <ref>     # só um
//
// Requer SUPABASE_ACCESS_TOKEN no .env.local (raiz).
// Saída: _local/schemas/<ref>.json  (bruto)
//        _local/schemas/<ref>.sql   (SQL sintético reconstruído)
//
// READ-ONLY. Só executa SELECT contra pg_catalog / information_schema.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, '_local', 'schemas')

// Carrega .env.local
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

const REFS = {
  'GabbWebs-Project (prata925)': 'ipovxwzzqjjywratrbjx',
  'sp-folheados': 'vsqbiapxqsscfwdqedip',
  'dona-prata': 'uanowddkpaxfaqutcewr',
  'prata925-outlet': 'olxbcerejwbvfqdtthyo',
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
    // 500 (OOM Redis), 502/504 (gateway/timeout), 429 (rate limit) → retry com backoff
    const retryable = [429, 500, 502, 503, 504].includes(res.status)
    if (retryable && attempt < 6) {
      const wait = 1000 * Math.pow(2, attempt - 1) // 1s, 2s, 4s, 8s, 16s
      process.stdout.write(`[HTTP ${res.status}, tentando de novo em ${wait / 1000}s] `)
      await sleep(wait)
      return runQuery(ref, sql, attempt + 1)
    }
    throw new Error(`HTTP ${res.status} em ${ref}: ${text.slice(0, 300)}`)
  }
  const json = JSON.parse(text)
  return Array.isArray(json) ? json : (json.result ?? json.data ?? [])
}

const QUERIES = {
  tables: `
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `,
  columns: `
    select
      c.table_name,
      c.column_name,
      c.ordinal_position,
      c.data_type,
      c.udt_name,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default,
      c.is_generated,
      c.generation_expression
    from information_schema.columns c
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position
  `,
  constraints: `
    select
      n.nspname as schema,
      cl.relname as table_name,
      con.conname as name,
      con.contype as type,
      pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
    order by cl.relname, con.conname
  `,
  indexes: `
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `,
  rls_enabled: `
    select relname
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relrowsecurity = true
    order by relname
  `,
  policies: `
    select
      schemaname, tablename, policyname, permissive,
      roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `,
  triggers: `
    select
      cl.relname as table_name,
      tg.tgname as trigger_name,
      pg_get_triggerdef(tg.oid) as definition
    from pg_trigger tg
    join pg_class cl on cl.oid = tg.tgrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and not tg.tgisinternal
    order by cl.relname, tg.tgname
  `,
  functions: `
    select
      p.proname as name,
      pg_get_function_identity_arguments(p.oid) as args,
      pg_get_functiondef(p.oid) as definition,
      l.lanname as language
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
    order by p.proname
  `,
  extensions: `
    select extname, extversion
    from pg_extension
    where extname not in ('plpgsql')
    order by extname
  `,
}

async function dumpOne(ref, label) {
  console.log(`\n=== ${label} (${ref}) ===`)
  const out = { ref, label, timestamp: new Date().toISOString() }
  for (const [name, sql] of Object.entries(QUERIES)) {
    process.stdout.write(`  ${name}... `)
    try {
      out[name] = await runQuery(ref, sql)
      console.log(`${out[name].length} linhas`)
    } catch (e) {
      console.log(`ERRO: ${e.message}`)
      out[name] = { error: e.message }
    }
    // 400ms de folga entre queries pra não bater no OOM do Redis da Mgmt API
    await sleep(400)
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = resolve(OUT_DIR, `${ref}.json`)
  writeFileSync(jsonPath, JSON.stringify(out, null, 2))
  console.log(`  -> ${jsonPath}`)

  const sql = renderSql(out)
  const sqlPath = resolve(OUT_DIR, `${ref}.sql`)
  writeFileSync(sqlPath, sql)
  console.log(`  -> ${sqlPath}`)
  return out
}

// Reconstrói CREATE TABLE / ALTER / CREATE INDEX / POLICY / TRIGGER / FUNCTION
function renderSql(dump) {
  const lines = []
  const push = (...xs) => lines.push(...xs)
  push(`-- Schema dump de ${dump.label} (${dump.ref}) em ${dump.timestamp}`)
  push(`-- Gerado por scripts/dump-schema.mjs. NÃO editar à mão.`)
  push(``)

  push(`-- Extensions`)
  for (const e of dump.extensions ?? []) {
    push(`create extension if not exists "${e.extname}";`)
  }
  push(``)

  // agrupa colunas por tabela
  const colsByTable = {}
  for (const c of dump.columns ?? []) {
    ;(colsByTable[c.table_name] ??= []).push(c)
  }
  const consByTable = {}
  for (const c of dump.constraints ?? []) {
    ;(consByTable[c.table_name] ??= []).push(c)
  }

  const tables = (dump.tables ?? []).map((t) => t.table_name).sort()
  for (const t of tables) {
    push(`-- ============================================================`)
    push(`-- table: public.${t}`)
    push(`-- ============================================================`)
    push(`create table if not exists public.${t} (`)
    const cols = colsByTable[t] ?? []
    const colLines = cols.map((c) => {
      const type = renderColumnType(c)
      const parts = [`  ${qid(c.column_name)}`, type]
      if (c.is_generated === 'ALWAYS' && c.generation_expression) {
        parts.push(`generated always as (${c.generation_expression}) stored`)
      }
      if (c.column_default && c.is_generated !== 'ALWAYS') {
        parts.push(`default ${c.column_default}`)
      }
      if (c.is_nullable === 'NO') parts.push(`not null`)
      return parts.join(' ')
    })
    push(colLines.join(',\n'))
    push(`);`)
    push(``)

    // constraints (skip NOT NULL, tratado inline)
    const cons = consByTable[t] ?? []
    for (const c of cons) {
      if (c.type === 'p' || c.type === 'u' || c.type === 'c' || c.type === 'f') {
        // usa nome existente pra manter determinismo entre dumps
        push(`-- constraint ${c.name} (${constraintType(c.type)})`)
        push(`alter table public.${t} drop constraint if exists ${qid(c.name)};`)
        push(`alter table public.${t} add constraint ${qid(c.name)} ${c.definition};`)
      }
    }
    push(``)
  }

  // RLS
  push(`-- ============================================================`)
  push(`-- RLS`)
  push(`-- ============================================================`)
  for (const r of dump.rls_enabled ?? []) {
    push(`alter table public.${qid(r.relname)} enable row level security;`)
  }
  push(``)

  // Policies
  for (const p of dump.policies ?? []) {
    push(`drop policy if exists ${qid(p.policyname)} on public.${qid(p.tablename)};`)
    push(renderPolicy(p) + ';')
  }
  push(``)

  // Indexes (skip os que vêm de UNIQUE/PK constraint)
  const consIndexNames = new Set(
    (dump.constraints ?? [])
      .filter((c) => c.type === 'p' || c.type === 'u')
      .map((c) => c.name),
  )
  push(`-- Indexes`)
  for (const i of dump.indexes ?? []) {
    if (consIndexNames.has(i.indexname)) continue
    push(`${i.indexdef.replace(/^create /i, 'create ')};`.replace(/;;$/, ';'))
  }
  push(``)

  // Functions
  push(`-- Functions`)
  for (const f of dump.functions ?? []) {
    push(f.definition + ';')
    push(``)
  }

  // Triggers
  push(`-- Triggers`)
  for (const t of dump.triggers ?? []) {
    push(`-- ${t.trigger_name} on ${t.table_name}`)
    push(`drop trigger if exists ${qid(t.trigger_name)} on public.${qid(t.table_name)};`)
    push(t.definition + ';')
    push(``)
  }

  return lines.join('\n') + '\n'
}

function qid(name) {
  // identificador simples: se contém só [a-z0-9_], sem aspas
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`
}

function constraintType(t) {
  return { p: 'PK', u: 'UNIQUE', c: 'CHECK', f: 'FK' }[t] ?? t
}

function renderColumnType(c) {
  // usa udt_name pra tipos como uuid, jsonb, text[], numeric
  const udt = c.udt_name
  if (udt === 'numeric' && c.numeric_precision) {
    return `numeric(${c.numeric_precision}${c.numeric_scale != null ? ',' + c.numeric_scale : ''})`
  }
  if (c.data_type === 'ARRAY') {
    // udt_name vem "_text" pra text[]
    return udt.replace(/^_/, '') + '[]'
  }
  if (c.data_type === 'character varying' && c.character_maximum_length) {
    return `varchar(${c.character_maximum_length})`
  }
  if (c.data_type === 'character' && c.character_maximum_length) {
    return `char(${c.character_maximum_length})`
  }
  return udt
}

function renderPolicy(p) {
  const parts = [`create policy ${qid(p.policyname)} on public.${qid(p.tablename)}`]
  if (p.permissive === 'PERMISSIVE') parts.push('as permissive')
  else if (p.permissive === 'RESTRICTIVE') parts.push('as restrictive')
  parts.push(`for ${p.cmd.toLowerCase()}`)
  if (p.roles && p.roles.length) {
    const roles = Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/^\{|\}$/g, '').split(',')
    parts.push(`to ${roles.join(', ')}`)
  }
  if (p.qual) parts.push(`using (${p.qual})`)
  if (p.with_check) parts.push(`with check (${p.with_check})`)
  return parts.join(' ')
}

async function main() {
  loadEnv()
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('SUPABASE_ACCESS_TOKEN não encontrado em .env.local')
    process.exit(1)
  }
  const args = process.argv.slice(2)
  const refIdx = args.indexOf('--ref')
  const only = refIdx >= 0 ? args[refIdx + 1] : null

  const entries = Object.entries(REFS).filter(([, r]) => (only ? r === only : true))
  if (!entries.length) {
    console.error('Nenhum ref pra processar')
    process.exit(1)
  }

  const results = []
  for (const [label, ref] of entries) {
    try {
      results.push(await dumpOne(ref, label))
    } catch (e) {
      console.error(`FALHA em ${label} (${ref}): ${e.message}`)
    }
  }
  console.log(`\nOK — ${results.length}/${entries.length} bancos dumpados.`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
