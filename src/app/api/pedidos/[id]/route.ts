import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  const supabase = supabaseAdmin()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !pedido) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  let revendedora: {
    nome: string
    nome_loja: string | null
    whatsapp: string
    subdominio: string
  } | null = null

  if (pedido.slug_revendedora) {
    const { data } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, whatsapp, subdominio')
      .eq('subdominio', pedido.slug_revendedora)
      .single()
    revendedora = data || null
  }

  // LGPD: NÃO devolver o CPF do comprador nessa rota (o id é UUID, mas o link
  // pode ser compartilhado/cair em logs). A tela de confirmação não usa CPF.
  const pedidoSeguro = { ...pedido } as Record<string, unknown>
  delete pedidoSeguro.cliente_cpf

  return NextResponse.json({ ...pedidoSeguro, revendedora })
}
