import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { AVISO_DIAS } from '@/lib/mensalidade'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Cron diário (Vercel Cron) — avisa antes de vencer e suspende lojas
// vencidas (no dia do vencimento). Também pode ser disparado manualmente
// pelo admin (Bearer prata925) com o botão "Rodar agora".
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  // Aceita: sessão/PIN admin (via checkAdminAuth), CRON_SECRET, ou o
  // header que a Vercel injeta nas execuções de cron. Sem nenhum → 401.
  const autorizado =
    checkAdminAuth(request) ||
    (!!cronSecret && auth === `Bearer ${cronSecret}`) ||
    request.headers.get('x-vercel-cron') === '1'

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const { data: revs, error } = await supabase
    .from('revendedoras')
    .select('id, nome, status, mensalidade_vence_em, mensalidade_isento')
    .eq('mensalidade_isento', false)
    .not('mensalidade_vence_em', 'is', null)
    .in('status', ['ativa', 'suspensa'])

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao consultar', detalhes: error.message },
      { status: 500 }
    )
  }

  let avisados = 0
  let vencem_hoje = 0
  let suspensos = 0

  for (const r of revs || []) {
    try {
      const v = new Date(`${r.mensalidade_vence_em}T00:00:00`)
      const dias = Math.round((v.getTime() - hoje.getTime()) / 86400000)

      if (dias === AVISO_DIAS) {
        await supabase.from('notificacoes').insert({
          revendedora_id: r.id,
          titulo: '⏰ Sua mensalidade vence em 5 dias',
          mensagem: `${(r.nome || '').split(' ')[0] || 'Oi'}, faltam 5 dias pra renovar sua loja Prata 925 💎 Mantenha tudo no ar e siga faturando. Pague pelo painel e fique tranquila! 🚀`,
          tipo: 'aviso',
        })
        avisados++
      } else if (dias === 0) {
        await supabase.from('notificacoes').insert({
          revendedora_id: r.id,
          titulo: '💛 Sua mensalidade vence HOJE',
          mensagem: `Hoje é o dia de renovar sua loja! Pague agora pra não perder o acesso e continuar vendendo prata 925 com 30% de comissão. Você consegue! ✨`,
          tipo: 'aviso',
        })
        vencem_hoje++
      } else if (dias < 0 && r.status === 'ativa') {
        await supabase
          .from('revendedoras')
          .update({ status: 'suspensa' })
          .eq('id', r.id)
        await supabase.from('notificacoes').insert({
          revendedora_id: r.id,
          titulo: '🔒 Loja pausada por mensalidade vencida',
          mensagem: `Sua loja foi pausada porque a mensalidade venceu. Mas é rapidinho voltar! 💪 Regularize o pagamento e sua loja volta ao ar na hora pra você seguir vendendo.`,
          tipo: 'aviso',
        })
        suspensos++
      }
    } catch (e) {
      console.error('cron mensalidade erro p/', r.id, e)
    }
  }

  // -------- Maturação de comissões (política 20 dias) --------
  // Aproveita o cron diário (Vercel Hobby = 2 crons máx). Chama a RPC
  // liberar_comissoes_maduras() criada em supabase/comissoes_20d.sql,
  // que move comissões 'processando' com data_liberacao <= now() para
  // 'liberada' (o trigger debita saldo_processando e credita
  // saldo_disponivel automaticamente).
  let comissoesLiberadas = 0
  let comissoesErro: string | null = null
  try {
    const { data, error: rpcError } = await supabase.rpc('liberar_comissoes_maduras')
    if (rpcError) comissoesErro = rpcError.message
    else comissoesLiberadas = Number(data ?? 0)
  } catch (e) {
    comissoesErro = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    ok: true,
    processadas: (revs || []).length,
    avisados,
    vencem_hoje,
    suspensos,
    comissoesLiberadas,
    comissoesErro,
  })
}
