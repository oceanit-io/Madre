// POST /api/track — registra visita anônima.
// Body: { pagina, sessao?, referrer? }
// Não loga IP nem User-Agent completo. Só "mobile"|"desktop"|"tablet".
// Pra dashboard de funil sem invadir privacidade.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function classificarUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const u = (ua || '').toLowerCase()
  if (/tablet|ipad/.test(u)) return 'tablet'
  if (/mobi|android|iphone/.test(u)) return 'mobile'
  return 'desktop'
}

export async function POST(request: Request) {
  let body: { pagina?: string; sessao?: string; referrer?: string } = {}
  try { body = await request.json() } catch { /* */ }

  const pagina = (body.pagina || '').trim().slice(0, 40)
  if (!pagina) {
    return NextResponse.json({ ok: false, erro: 'pagina obrigatória' }, { status: 400 })
  }
  const sessao = (body.sessao || '').slice(0, 64) || null
  const referrer = (body.referrer || '').slice(0, 200) || null
  const ua = request.headers.get('user-agent') || ''
  const user_agent_short = classificarUA(ua)

  try {
    const supabase = supabaseAdmin()
    await supabase.from('visitas').insert({
      pagina,
      user_agent_short,
      sessao,
      referrer,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[track] falhou:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
