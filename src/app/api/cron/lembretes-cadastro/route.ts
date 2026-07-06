// Cron diário (Vercel Cron) — dispara lembrete 24h pra revendedoras
// que cadastraram mas não pagaram em 24h.
//
// Regras:
// - status='pendente' (não ativou ainda)
// - criado_em entre 24h e 7 dias atrás (não bombardeia quem cadastrou
//   há semanas e largou)
// - lembrete_24h_enviado_em IS NULL (não duplica envio)
//
// Manual: GET /api/cron/lembretes-cadastro com Bearer ADMIN_PIN.
// Automático: Vercel Cron diário 11:00 BRT (14:00 UTC).

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail } from '@/lib/email'
import { lembreteCadastro24hEmail } from '@/lib/emailTemplates'
import { criarLinkCadastroInfinitePay } from '@/lib/infinitepay'

export const dynamic = 'force-dynamic'

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

  // Janela: cadastrou entre 24h e 7 dias atrás, ainda pendente,
  // ainda não recebeu o lembrete.
  const agora = new Date()
  const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const limite7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidatas, error } = await supabase
    .from('revendedoras')
    .select('id, nome, email, whatsapp, criado_em')
    .eq('status', 'pendente')
    .lte('criado_em', limite24h)
    .gte('criado_em', limite7d)
    .is('lembrete_24h_enviado_em', null)
    .limit(100)

  if (error) {
    console.error('[cron/lembretes-cadastro] erro consulta:', error.message)
    return NextResponse.json({ erro: 'Erro ao buscar candidatas', detalhes: error.message }, { status: 500 })
  }

  const resultados: Array<{ id: string; email: string; ok: boolean }> = []

  for (const r of candidatas || []) {
    try {
      // Gera link InfinitePay dinâmico (único por revendedora)
      const linkRes = await criarLinkCadastroInfinitePay({
        revendedora_id: r.id,
        nome: r.nome || '',
        email: r.email,
        whatsapp: r.whatsapp || '',
      })
      if (!linkRes) {
        console.error('[cron/lembretes-cadastro] sem link pra', r.email)
        resultados.push({ id: r.id, email: r.email, ok: false })
        continue
      }
      const { subject, html } = lembreteCadastro24hEmail({
        nome: r.nome || '',
        linkPagamento: linkRes.url,
      })
      const env = await enviarEmail({ to: r.email, subject, html })
      if (env.ok) {
        await supabase
          .from('revendedoras')
          .update({ lembrete_24h_enviado_em: new Date().toISOString() })
          .eq('id', r.id)
      }
      resultados.push({ id: r.id, email: r.email, ok: env.ok })
    } catch (e) {
      console.error('[cron/lembretes-cadastro] falha pra', r.email, e)
      resultados.push({ id: r.id, email: r.email, ok: false })
    }
  }

  return NextResponse.json({
    ok: true,
    encontradas: (candidatas || []).length,
    enviadas: resultados.filter(r => r.ok).length,
    falhadas: resultados.filter(r => !r.ok).length,
    timestamp: new Date().toISOString(),
  })
}
