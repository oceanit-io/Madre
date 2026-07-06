import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail } from '@/lib/email'
import { lojaAtivadaEmail } from '@/lib/emailTemplates'
import { CICLO_DIAS } from '@/lib/mensalidade'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const { revendedora_id, nome } = await req.json()

  const supabase = supabaseAdmin()

  // Calcula próximo vencimento da mensalidade: hoje + 30 dias.
  // (Só atualiza se ainda for null — não sobrescreve se a revendedora
  // já foi ativada antes e tem uma data válida.)
  const proxVenc = new Date()
  proxVenc.setDate(proxVenc.getDate() + CICLO_DIAS)
  const proxVencISO = proxVenc.toISOString().slice(0, 10)

  // 1. Atualiza status + mensalidade_vence_em (crítico).
  //    Só define o vencimento se ainda for NULL (1ª ativação). Numa
  //    reativação NÃO sobrescreve a data existente — senão dava ciclo grátis
  //    / bagunçava a cobrança (o comentário antigo prometia isso mas o código
  //    pisava sempre).
  const { data: atualRev } = await supabase
    .from('revendedoras')
    .select('mensalidade_vence_em')
    .eq('id', revendedora_id)
    .maybeSingle()

  const updatePayload: { status: string; mensalidade_vence_em?: string } = { status: 'ativa' }
  if (!atualRev?.mensalidade_vence_em) {
    updatePayload.mensalidade_vence_em = proxVencISO
  }

  const { error: errStatus } = await supabase
    .from('revendedoras')
    .update(updatePayload)
    .eq('id', revendedora_id)

  if (errStatus) {
    return NextResponse.json({ error: 'Erro ao ativar status', detalhes: errStatus.message }, { status: 500 })
  }

  // 2. Lê dados da revendedora p/ a notif in-app e o e-mail.
  const { data: rev } = await supabase
    .from('revendedoras')
    .select('email, nome, nome_loja, subdominio')
    .eq('id', revendedora_id)
    .single()

  // 3. Cria notificação in-app (não-crítico).
  try {
    const { error: errNotif } = await supabase
      .from('notificacoes')
      .insert({
        revendedora_id,
        titulo: '🎉 Sua conta foi ativada!',
        mensagem: 'Parabéns! Agora você pode começar a vender.',
        tipo: 'sucesso',
        lida: false,
      })

    if (errNotif) {
      console.error('Aviso: notificação não foi criada:', errNotif.message)
    }
  } catch (e) {
    console.error('Erro silencioso ao criar notificação:', e)
  }

  // 3b. Limpa alertas admin PENDENTES dessa revendedora — já está ativa, então
  //     "pagamento sem match / pendente logou" não é mais acionável e só polui
  //     o painel. Marca como lidas as alertas não-lidas cujo email bate com o
  //     da revendedora ativada. Best-effort.
  try {
    const emailRev = (rev?.email || '').trim().toLowerCase()
    if (emailRev) {
      const { data: alertasAbertos } = await supabase
        .from('admin_alertas')
        .select('id, detalhes')
        .eq('lida', false)
      const idsResolver = (alertasAbertos || [])
        .filter(a => {
          const d = (a.detalhes || {}) as Record<string, unknown>
          const e1 = String(d.customer_email || '').trim().toLowerCase()
          const e2 = String(d.email || '').trim().toLowerCase()
          return e1 === emailRev || e2 === emailRev
        })
        .map(a => a.id)
      if (idsResolver.length > 0) {
        await supabase
          .from('admin_alertas')
          .update({ lida: true, lida_em: new Date().toISOString(), lida_por: 'auto-ativacao' })
          .in('id', idsResolver)
      }
    }
  } catch (e) {
    console.error('[ativar] falha ao limpar alertas pendentes:', e)
  }

  // 4. E-mail de boas-vindas (best-effort: NÃO bloqueia a ativação se
  //    Resend falhar ou estiver sem RESEND_API_KEY).
  let emailEnviado: boolean | undefined
  if (rev?.email && rev?.subdominio) {
    try {
      const { subject, html } = lojaAtivadaEmail({
        nome: rev.nome || nome,
        nomeLoja: rev.nome_loja,
        subdominio: rev.subdominio,
      })
      const r = await enviarEmail({ to: rev.email, subject, html })
      emailEnviado = r.ok
      if ('motivo' in r) console.warn('[ativar] email não enviado:', r.motivo)
    } catch (e) {
      console.error('[ativar] erro enviando email:', e)
      emailEnviado = false
    }
  }

  await logAdminAction({
    request: req,
    acao: 'ativar_revendedora',
    alvo: revendedora_id,
    detalhes: { nome: rev?.nome || nome, email: rev?.email, subdominio: rev?.subdominio, emailEnviado },
  })

  return NextResponse.json({ sucesso: true, nome, emailEnviado })
}