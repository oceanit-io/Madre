// POST /api/admin/corrigir-url
//
// Permite a admin trocar a URL (subdominio) de qualquer revendedora.
// Útil pra arrumar as que foram cadastradas antes do feature do
// editor em /configurar-loja: tinham URL feia tipo "edna-3201".
//
// Body:
//   { revendedora_id: string, nova_url: string }
//
// Retorna:
//   { ok: true, url_antiga, url_nova } | { erro: string }

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const RESERVADAS = new Set([
  'admin', 'api', 'auth', 'app', 'login', 'logout', 'register', 'cadastro',
  'dashboard', 'painel', 'perfil', 'configurar-loja', 'configurar', 'vendas',
  'saldo', 'carrinho', 'checkout', 'pedido', 'pedidos', 'produto', 'produtos',
  'loja', 'lojas', 'home', 'help', 'ajuda', 'sobre', 'contato', 'suporte',
  'pagbank', 'pagarme', 'webhook', 'static', '_next', 'www', 'public',
])

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const revendedora_id = (body?.revendedora_id || '').toString().trim()
  const nova_url = (body?.nova_url || '').toString().trim().toLowerCase()

  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }
  if (!nova_url) {
    return NextResponse.json({ erro: 'nova_url obrigatório' }, { status: 400 })
  }
  if (nova_url.length < 3 || nova_url.length > 30) {
    return NextResponse.json({ erro: 'URL deve ter entre 3 e 30 caracteres' }, { status: 400 })
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nova_url)) {
    return NextResponse.json({ erro: 'URL pode ter só letras (a-z), números e hífens' }, { status: 400 })
  }
  if (RESERVADAS.has(nova_url)) {
    return NextResponse.json({ erro: 'Essa URL é reservada' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { data: rev, error: revErr } = await supabase
    .from('revendedoras')
    .select('id, subdominio, nome, nome_loja')
    .eq('id', revendedora_id)
    .maybeSingle()

  if (revErr || !rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  if (rev.subdominio === nova_url) {
    return NextResponse.json({ erro: 'A URL nova é igual à atual' }, { status: 400 })
  }

  // Confere uniqueness
  const { data: jaExiste } = await supabase
    .from('revendedoras')
    .select('id, nome')
    .eq('subdominio', nova_url)
    .neq('id', revendedora_id)
    .maybeSingle()

  if (jaExiste) {
    return NextResponse.json({
      erro: `Essa URL já está em uso pela revendedora "${jaExiste.nome}"`
    }, { status: 409 })
  }

  const { error: updErr } = await supabase
    .from('revendedoras')
    .update({ subdominio: nova_url })
    .eq('id', revendedora_id)

  if (updErr) {
    return NextResponse.json({
      erro: `Falha ao salvar: ${updErr.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    url_antiga: rev.subdominio,
    url_nova: nova_url,
    nome: rev.nome,
  })
}
