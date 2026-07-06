import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { transicaoValida } from '@/lib/pedidoStatus'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { emailsAoMudarStatus } from '@/lib/pedidoEmails'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function db() {
  return supabaseAdmin()
}

async function montarResposta(supabase: ReturnType<typeof db>, id: string) {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !pedido) return null

  const { data: historico } = await supabase
    .from('pedidos_historico')
    .select('*')
    .eq('pedido_id', id)
    .order('created_at', { ascending: false })

  const { data: comissao } = await supabase
    .from('comissoes')
    .select('*')
    .eq('pedido_id', id)
    .maybeSingle()

  let revendedora: {
    nome: string
    nome_loja: string | null
    whatsapp: string
    subdominio: string
    foto_url: string | null
    cidade: string | null
    estado: string | null
  } | null = null

  if (pedido.slug_revendedora) {
    const { data } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, whatsapp, subdominio, foto_url, cidade, estado')
      .eq('subdominio', pedido.slug_revendedora)
      .single()
    revendedora = data || null
  }

  return { ...pedido, historico: historico || [], comissao: comissao || null, revendedora }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  const supabase = db()
  const resposta = await montarResposta(supabase, params.id)
  if (!resposta) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }
  return NextResponse.json(resposta)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  let body: { status?: string; observacao?: string; codigo_rastreio?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const novoStatus = (body.status || '').trim()
  const observacao = (body.observacao || '').trim()
  // codigo_rastreio: trim, limita 50 chars, '' significa LIMPAR (set null).
  // undefined significa NÃO MEXER. Distinção importante pra não apagar
  // acidentalmente em chamadas que só atualizam status.
  const codigoRastreioInput = body.codigo_rastreio
  const codigoRastreio = codigoRastreioInput !== undefined
    ? codigoRastreioInput.toString().trim().slice(0, 50)
    : undefined

  if (!novoStatus && !observacao && codigoRastreio === undefined) {
    return NextResponse.json(
      { erro: 'Nada para atualizar' },
      { status: 400 }
    )
  }

  const supabase = db()

  const { data: atual, error: errAtual } = await supabase
    .from('pedidos')
    .select('id, status, observacoes, numero_pedido, cliente_nome, cliente_email, total, slug_revendedora, codigo_rastreio')
    .eq('id', params.id)
    .single()

  if (errAtual || !atual) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  // ----- Mudança de status (validação server-side) -----
  if (novoStatus && novoStatus !== atual.status) {
    if (!transicaoValida(atual.status, novoStatus)) {
      return NextResponse.json(
        {
          erro: `Transição inválida: ${atual.status} → ${novoStatus}`,
        },
        { status: 400 }
      )
    }

    const { error: errUpd } = await supabase
      .from('pedidos')
      .update({ status: novoStatus })
      .eq('id', params.id)

    if (errUpd) {
      return NextResponse.json(
        { erro: 'Erro ao atualizar status', detalhes: errUpd.message },
        { status: 500 }
      )
    }
    // O trigger registra o histórico e cria/cancela a comissão.
    // E-mails de status (pago/enviado) — best-effort, não quebra a resposta.
    // Código de rastreio efetivo: o que vier neste PATCH tem prioridade (pra o
    // e-mail de "enviado" já sair com o código), senão o que já estava salvo.
    const codigoEfetivo = codigoRastreio !== undefined
      ? (codigoRastreio || null)
      : ((atual as { codigo_rastreio?: string | null }).codigo_rastreio ?? null)
    await emailsAoMudarStatus(supabase, { ...atual, codigo_rastreio: codigoEfetivo }, novoStatus)
  }

  // ----- Observação (append + histórico próprio) -----
  if (observacao) {
    const carimbo = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const linha = `[${carimbo}] ${observacao}`
    const novasObs = atual.observacoes
      ? `${atual.observacoes}\n${linha}`
      : linha

    const { error: errObs } = await supabase
      .from('pedidos')
      .update({ observacoes: novasObs })
      .eq('id', params.id)

    if (errObs) {
      return NextResponse.json(
        { erro: 'Erro ao salvar observação', detalhes: errObs.message },
        { status: 500 }
      )
    }

    const statusFinal = novoStatus && novoStatus !== atual.status
      ? novoStatus
      : atual.status

    await supabase.from('pedidos_historico').insert({
      pedido_id: params.id,
      status_anterior: statusFinal,
      status_novo: statusFinal,
      observacao: `Observação adicionada: ${observacao}`,
      created_by: 'admin',
    })
  }

  // ----- Código de rastreio Correios -----
  if (codigoRastreio !== undefined) {
    const valorParaGravar = codigoRastreio === '' ? null : codigoRastreio
    const { error: errRast } = await supabase
      .from('pedidos')
      .update({ codigo_rastreio: valorParaGravar })
      .eq('id', params.id)

    if (errRast) {
      return NextResponse.json(
        { erro: 'Erro ao salvar código de rastreio', detalhes: errRast.message },
        { status: 500 }
      )
    }
  }

  await logAdminAction({
    request,
    acao: 'editar_pedido',
    alvo: atual.numero_pedido || params.id,
    detalhes: {
      mudancaStatus: novoStatus && novoStatus !== atual.status ? `${atual.status}→${novoStatus}` : null,
      observacao: observacao || null,
      codigo_rastreio: codigoRastreio !== undefined ? (codigoRastreio || null) : undefined,
    },
  })

  const resposta = await montarResposta(supabase, params.id)
  if (!resposta) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }
  return NextResponse.json(resposta)
}
