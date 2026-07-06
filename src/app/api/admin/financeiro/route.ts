import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const { searchParams } = new URL(request.url)
  const de = searchParams.get('de') || ''
  const ate = searchParams.get('ate') || ''

  // ---- Pedidos faturados (pago/enviado/entregue) no período ----
  let qPed = supabase
    .from('pedidos')
    .select('subtotal, frete, total, status, created_at')
    .in('status', ['pago', 'enviado', 'entregue'])
  if (de) qPed = qPed.gte('created_at', de)
  if (ate) qPed = qPed.lte('created_at', ate)

  const { data: pedidos, error: errPed } = await qPed
  if (errPed) {
    return NextResponse.json(
      { erro: 'Erro ao consultar pedidos', detalhes: errPed.message },
      { status: 500 }
    )
  }

  const peds = pedidos || []
  const faturado = peds.reduce((a, p) => a + Number(p.total || 0), 0)
  const produtos = peds.reduce((a, p) => a + Number(p.subtotal || 0), 0)
  const frete = peds.reduce((a, p) => a + Number(p.frete || 0), 0)
  const qtdPedidos = peds.length
  const ticketMedio = qtdPedidos > 0 ? faturado / qtdPedidos : 0

  // ---- Comissões no período ----
  let qCom = supabase
    .from('comissoes')
    .select('id, valor_comissao, status, slug_revendedora, revendedora_id, created_at, data_liberacao')
  if (de) qCom = qCom.gte('created_at', de)
  if (ate) qCom = qCom.lte('created_at', ate)

  const { data: comissoesRaw } = await qCom
  const comissoes = comissoesRaw || []

  const somaPorStatus = (st: string[]) =>
    comissoes
      .filter(c => st.includes(c.status))
      .reduce((a, c) => a + Number(c.valor_comissao || 0), 0)

  const comissoesEfetivas = somaPorStatus(['liberada', 'paga']) // já no saldo da revendedora
  const comissoesProcessando = somaPorStatus(['processando']) // 20d de carência anti-fraude
  const comissoesPendentes = somaPorStatus(['pendente']) // órfão (sem revendedora)
  const comissoesCanceladas = somaPorStatus(['cancelada'])

  // Líquido do negócio = faturado − frete − tudo que vai pra revendedora
  // (efetivas já liberadas + processando que vão liberar nos próximos
  // 20 dias). Não desconta canceladas nem órfãs.
  const liquido = faturado - frete - comissoesEfetivas - comissoesProcessando

  // ---- Reflexo financeiro REAL: o que cada parte de fato recebe ----
  // Mesmos percentuais do split do checkout. A Prata 15 (empresa) ABSORVE a
  // taxa do Pagar.me — por isso a revendedora cobra 30% LIMPO e a empresa fica
  // com ~65% líquido. As taxas são configuráveis por env (gateway + Ocean)
  // porque o valor EXATO por transação vive no Pagar.me e varia por
  // método/parcelas — aqui é o efetivo médio pra relatório.
  const REV_PCT = Number(process.env.PAGARME_REVENDEDORA_PERCENT) || 0.30
  const PRATA15_PCT = Number(process.env.PAGARME_PRATA15_PERCENT) || 0.695
  const TAXA_GATEWAY_PCT = Number(process.env.TAXA_GATEWAY_PCT) || 0.035 // banco/adquirente
  const TAXA_OCEAN_PCT = Number(process.env.TAXA_OCEAN_PCT) || 0.01       // operadora Ocean IT
  const taxaPct = TAXA_GATEWAY_PCT + TAXA_OCEAN_PCT

  const revendedoras30 = produtos * REV_PCT                          // 30% (limpo)
  const contaMae = produtos * Math.max(0, 1 - PRATA15_PCT - REV_PCT) // ~0,5% (limpo)
  const taxas = faturado * taxaPct                                   // banco + Ocean
  const prata15Bruto = produtos * PRATA15_PCT                        // 69,5% do subtotal
  // Frete entra e sai (cobrado do cliente, pago aos Correios) → não é lucro.
  // Líquido da empresa = margem de produto da Prata 15 menos a taxa que absorve.
  const liquidoEmpresa = prata15Bruto - taxas

  // ---- Comissões por revendedora (tudo que o negócio deve a ela,
  // incluindo as em processamento de 20d — ela já "ganhou" a venda) ----
  const porSlug = new Map<string, { total: number; qtd: number }>()
  for (const c of comissoes) {
    if (c.status === 'cancelada' || c.status === 'pendente') continue
    const slug = c.slug_revendedora || '—'
    const cur = porSlug.get(slug) || { total: 0, qtd: 0 }
    cur.total += Number(c.valor_comissao || 0)
    cur.qtd += 1
    porSlug.set(slug, cur)
  }

  const slugs = Array.from(porSlug.keys()).filter(s => s !== '—')
  const mapaNome = new Map<string, string>()
  if (slugs.length > 0) {
    const { data: revs } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, subdominio')
      .in('subdominio', slugs)
    for (const r of revs || []) {
      // Mostra a PESSOA que criou (nome real) primeiro — o nome de fantasia
      // sozinho não diz de quem é a comissão. Loja vai como contexto.
      const pessoa = (r.nome || '').trim()
      const loja = (r.nome_loja || '').trim()
      const label = pessoa
        ? (loja && loja !== pessoa ? `${pessoa} · ${loja}` : pessoa)
        : (loja || r.subdominio)
      mapaNome.set(r.subdominio, label)
    }
  }

  const porRevendedora = Array.from(porSlug.entries())
    .map(([slug, v]) => ({
      slug,
      nome: mapaNome.get(slug) || slug,
      total: v.total,
      qtd: v.qtd,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25)

  // ---- Cronograma: cada comissão com a DATA em que é liberada (vira sacável).
  // Pra relatório que bate com o extrato do banco: a revendedora só pode ser
  // paga a partir de data_liberacao. Ordenado por data (próximas a liberar
  // primeiro). 'processando' = ainda em carência; 'liberada'/'paga' = já pode.
  const comissoesDetalhe = comissoes
    .filter(c => c.status === 'processando' || c.status === 'liberada' || c.status === 'paga')
    .map(c => ({
      id: c.id,
      nome: mapaNome.get(c.slug_revendedora || '') || c.slug_revendedora || '—',
      slug: c.slug_revendedora || '—',
      valor: Number(c.valor_comissao || 0),
      status: c.status,
      data_liberacao: c.data_liberacao || null,
      criado_em: c.created_at,
    }))
    .sort((a, b) => {
      const da = a.data_liberacao ? Date.parse(a.data_liberacao) : Infinity
      const db = b.data_liberacao ? Date.parse(b.data_liberacao) : Infinity
      return da - db
    })
    .slice(0, 300)

  return NextResponse.json({
    faturado,
    produtos,
    frete,
    qtdPedidos,
    ticketMedio,
    comissoesEfetivas,
    comissoesProcessando,
    comissoesPendentes,
    comissoesCanceladas,
    liquido,
    // Reflexo financeiro real (quem recebe o quê, líquido de taxa):
    revendedoras30,
    contaMae,
    taxas,
    taxaPct,
    prata15Bruto,
    liquidoEmpresa,
    porRevendedora,
    comissoesDetalhe,
  })
}
