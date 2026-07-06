import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

// Lista os pedidos da loja da revendedora logada, com detalhe completo
// (cliente, endereço, itens, totais) e a comissão associada de cada um.
// É a fonte da página /vendas — a revendedora vê o que vendeu, quem
// comprou, pra onde mandar, e o quanto vai ganhar.
export async function GET(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { rev, admin } = sessao

  const { data: peds } = await admin
    .from('pedidos')
    .select('id, numero_pedido, status, created_at, cliente_nome, cliente_email, cliente_telefone, cliente_cpf, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, itens, subtotal, frete, total, regiao_frete, observacoes, codigo_rastreio')
    .eq('slug_revendedora', rev.subdominio)
    .order('created_at', { ascending: false })
    .limit(200)

  const pedidos = peds || []
  const pedidoIds = pedidos.map(p => p.id as string)

  // Comissões associadas (uma por pedido pago).
  const mapaCom = new Map<string, { valor: number; percentual: number; status: string }>()
  if (pedidoIds.length > 0) {
    const { data: coms } = await admin
      .from('comissoes')
      .select('pedido_id, valor_comissao, percentual, status')
      .in('pedido_id', pedidoIds)
    for (const c of coms || []) {
      if (!c.pedido_id) continue
      mapaCom.set(c.pedido_id as string, {
        valor: Number(c.valor_comissao || 0),
        percentual: Number(c.percentual || 0),
        status: String(c.status || ''),
      })
    }
  }

  const view = pedidos.map(p => ({
    id: p.id as string,
    numero_pedido: (p.numero_pedido as string) || null,
    status: p.status as string,
    created_at: p.created_at as string,
    cliente: {
      nome: (p.cliente_nome as string) || '',
      email: (p.cliente_email as string) || '',
      telefone: (p.cliente_telefone as string) || '',
      cpf: (p.cliente_cpf as string) || '',
    },
    endereco: {
      cep: (p.endereco_cep as string) || '',
      rua: (p.endereco_rua as string) || '',
      numero: (p.endereco_numero as string) || '',
      complemento: (p.endereco_complemento as string) || null,
      bairro: (p.endereco_bairro as string) || '',
      cidade: (p.endereco_cidade as string) || '',
      uf: (p.endereco_uf as string) || '',
    },
    itens: Array.isArray(p.itens) ? p.itens : [],
    subtotal: Number(p.subtotal || 0),
    frete: Number(p.frete || 0),
    total: Number(p.total || 0),
    regiao_frete: (p.regiao_frete as string) || null,
    observacoes: (p.observacoes as string) || null,
    codigo_rastreio: (p.codigo_rastreio as string) || null,
    comissao: mapaCom.get(p.id as string) || null,
  }))

  return NextResponse.json({ pedidos: view })
}
