// GET /api/cron/mensagem-diaria — e-mail motivacional diário (7h Brasília).
// Manda a "mensagem do dia" (a mesma que aparece no dashboard) pra todas as
// revendedoras ATIVAS. Roda via Vercel Cron às 10:00 UTC (= 7h BRT).
//
// Sem BCC de monitoramento por envio (seriam dezenas/dia); manda 1 cópia
// pra Gabriela no fim. Best-effort: falha de e-mail não trava o resto.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail } from '@/lib/email'
import { mensagemDiariaEmail } from '@/lib/emailTemplates'
import { mensagemDoDia } from '@/lib/mensagensMotivacionais'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  const autorizado =
    checkAdminAuth(request) ||
    (!!cronSecret && auth === `Bearer ${cronSecret}`) ||
    request.headers.get('x-vercel-cron') === '1'

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()
  const { data: revs, error } = await supabase
    .from('revendedoras')
    .select('id, nome, email')
    .eq('status', 'ativa')

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao consultar', detalhes: error.message },
      { status: 500 }
    )
  }

  const mensagem = mensagemDoDia()
  let enviados = 0
  let falhas = 0

  for (const r of revs || []) {
    if (!r.email) continue
    try {
      const { subject, html } = mensagemDiariaEmail({
        nome: r.nome || 'revendedora',
        mensagem,
      })
      const res = await enviarEmail({ to: r.email, subject, html, pularCopiaMonitor: true })
      if (res.ok) enviados++
      else falhas++
    } catch {
      falhas++
    }
  }

  // Uma cópia pra Gabriela monitorar (em vez de BCC em cada um dos N envios).
  const monitor = process.env.MONITOR_EMAIL_BCC ?? 'gabyfernandezmun@gmail.com'
  if (monitor) {
    try {
      const { subject, html } = mensagemDiariaEmail({ nome: 'Gabriela', mensagem })
      await enviarEmail({
        to: monitor,
        subject: `[cópia · ${enviados} envios] ${subject}`,
        html,
        pularCopiaMonitor: true,
      })
    } catch { /* silencioso */ }
  }

  return NextResponse.json({
    ok: true,
    total: (revs || []).length,
    enviados,
    falhas,
    mensagem,
  })
}
