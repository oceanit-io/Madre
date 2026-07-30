#!/usr/bin/env node
// diff-schemas.mjs — compara dois dumps de schema (JSON gerado por dump-schema.mjs).
//
// Uso: node scripts/diff-schemas.mjs <ref-a> <ref-b>
//
// Não é diff bit-perfect (pg_dump não gera 100% igual), mas cobre o que
// importa: tabelas, colunas por tabela, RLS on/off, nomes de policies,
// triggers, funções, extensões.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const [refA, refB] = process.argv.slice(2)
if (!refA || !refB) {
  console.error('Uso: node scripts/diff-schemas.mjs <ref-a> <ref-b>')
  process.exit(1)
}

const A = JSON.parse(readFileSync(resolve(ROOT, `_local/schemas/${refA}.json`), 'utf8'))
const B = JSON.parse(readFileSync(resolve(ROOT, `_local/schemas/${refB}.json`), 'utf8'))

console.log(`\nA = ${A.label} (${A.ref})`)
console.log(`B = ${B.label} (${B.ref})`)
console.log('='.repeat(60))

function setDiff(a, b) {
  const only_a = [...a].filter((x) => !b.has(x)).sort()
  const only_b = [...b].filter((x) => !a.has(x)).sort()
  return { only_a, only_b }
}

// TABELAS
const tblA = new Set((A.tables || []).map((t) => t.table_name))
const tblB = new Set((B.tables || []).map((t) => t.table_name))
console.log(`\n📋 TABELAS  A=${tblA.size} B=${tblB.size}`)
const t = setDiff(tblA, tblB)
if (t.only_a.length) console.log(`  só em A: ${t.only_a.join(', ')}`)
if (t.only_b.length) console.log(`  só em B: ${t.only_b.join(', ')}`)

// COLUNAS por tabela
const colsA = {}
for (const c of A.columns || []) (colsA[c.table_name] ??= new Set()).add(c.column_name)
const colsB = {}
for (const c of B.columns || []) (colsB[c.table_name] ??= new Set()).add(c.column_name)
const commonTbls = [...tblA].filter((t) => tblB.has(t)).sort()
console.log(`\n🔤 COLUNAS  (em ${commonTbls.length} tabelas comuns)`)
for (const t of commonTbls) {
  const d = setDiff(colsA[t] || new Set(), colsB[t] || new Set())
  if (d.only_a.length || d.only_b.length) {
    console.log(`  ${t}:`)
    if (d.only_a.length) console.log(`    só em A: ${d.only_a.join(', ')}`)
    if (d.only_b.length) console.log(`    só em B: ${d.only_b.join(', ')}`)
  }
}

// RLS
const rlsA = new Set((A.rls_enabled || []).map((r) => r.relname))
const rlsB = new Set((B.rls_enabled || []).map((r) => r.relname))
console.log(`\n🔒 RLS ENABLED  A=${rlsA.size} B=${rlsB.size}`)
const r = setDiff(rlsA, rlsB)
if (r.only_a.length) console.log(`  só em A: ${r.only_a.join(', ')}`)
if (r.only_b.length) console.log(`  só em B: ${r.only_b.join(', ')}`)

// POLICIES (por tabela+nome)
const polA = new Set((A.policies || []).map((p) => `${p.tablename}.${p.policyname}`))
const polB = new Set((B.policies || []).map((p) => `${p.tablename}.${p.policyname}`))
console.log(`\n🛡️  POLICIES  A=${polA.size} B=${polB.size}`)
const p = setDiff(polA, polB)
if (p.only_a.length) console.log(`  só em A: ${p.only_a.slice(0, 20).join(', ')}${p.only_a.length > 20 ? '...' : ''}`)
if (p.only_b.length) console.log(`  só em B: ${p.only_b.slice(0, 20).join(', ')}${p.only_b.length > 20 ? '...' : ''}`)

// TRIGGERS
const trgA = new Set((A.triggers || []).map((t) => `${t.table_name}.${t.trigger_name}`))
const trgB = new Set((B.triggers || []).map((t) => `${t.table_name}.${t.trigger_name}`))
console.log(`\n⚡ TRIGGERS  A=${trgA.size} B=${trgB.size}`)
const tr = setDiff(trgA, trgB)
if (tr.only_a.length) console.log(`  só em A: ${tr.only_a.join(', ')}`)
if (tr.only_b.length) console.log(`  só em B: ${tr.only_b.join(', ')}`)

// FUNCTIONS
const fnA = new Set((A.functions || []).map((f) => f.name + '(' + f.args + ')'))
const fnB = new Set((B.functions || []).map((f) => f.name + '(' + f.args + ')'))
console.log(`\n🧩 FUNCTIONS  A=${fnA.size} B=${fnB.size}`)
const fn = setDiff(fnA, fnB)
if (fn.only_a.length) console.log(`  só em A (${fn.only_a.length}):`, fn.only_a.slice(0, 15).join(', ') + (fn.only_a.length > 15 ? '...' : ''))
if (fn.only_b.length) console.log(`  só em B (${fn.only_b.length}):`, fn.only_b.slice(0, 15).join(', ') + (fn.only_b.length > 15 ? '...' : ''))

// EXTENSIONS
const extA = new Set((A.extensions || []).map((e) => e.extname))
const extB = new Set((B.extensions || []).map((e) => e.extname))
console.log(`\n🧬 EXTENSIONS  A=${extA.size} B=${extB.size}`)
const ex = setDiff(extA, extB)
if (ex.only_a.length) console.log(`  só em A: ${ex.only_a.join(', ')}`)
if (ex.only_b.length) console.log(`  só em B: ${ex.only_b.join(', ')}`)
