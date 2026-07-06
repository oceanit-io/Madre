// GET /api/admin/visitas — agregados de tráfego pra dashboard admin.
// Responde:
//   - hoje:   { landing, register, ratio_conversao }
//   - 7 dias por dia
//   - últimas 24h por hora
//   - origem (mobile/desktop/tablet)
//   - referrers top
//   - únicos vs total

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const supabase = supabaseAdmin()
  const agora = new Date()
  const ontemMeiaNoite = new Date(agora)
  ontemMeiaNoite.setHours(0, 0, 0, 0)
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)
  const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  // --- HOJE ---
  const { data: hoje } = await supabase
    .from('visitas')
    .select('pagina, sessao')
    .gte('criado_em', ontemMeiaNoite.toISOString())

  const hojeLanding = (hoje || []).filter(v => v.pagina === 'landing').length
  const hojeRegister = (hoje || []).filter(v => v.pagina === 'register').length
  const hojeLandingUnicos = new Set((hoje || []).filter(v => v.pagina === 'landing').map(v => v.sessao).filter(Boolean)).size
  const hojeRegisterUnicos = new Set((hoje || []).filter(v => v.pagina === 'register').map(v => v.sessao).filter(Boolean)).size
  const conversaoHoje = hojeLanding > 0 ? (hojeRegister / hojeLanding) * 100 : 0

  // --- 7 dias por dia ---
  const { data: ultimos7d } = await supabase
    .from('visitas')
    .select('pagina, criado_em')
    .gte('criado_em', seteDiasAtras.toISOString())
    .order('criado_em', { ascending: true })

  const porDia: Record<string, { landing: number; register: number }> = {}
  for (const v of ultimos7d || []) {
    const dia = (v.criado_em as string).slice(0, 10) // YYYY-MM-DD
    if (!porDia[dia]) porDia[dia] = { landing: 0, register: 0 }
    if (v.pagina === 'landing') porDia[dia].landing++
    if (v.pagina === 'register') porDia[dia].register++
  }

  // --- últimas 24h por hora ---
  const { data: ultimas24h } = await supabase
    .from('visitas')
    .select('pagina, criado_em, user_agent_short, referrer, sessao')
    .gte('criado_em', umDiaAtras.toISOString())

  const porHora: Record<string, { landing: number; register: number }> = {}
  for (const v of ultimas24h || []) {
    const hora = (v.criado_em as string).slice(0, 13) + ':00' // YYYY-MM-DDTHH:00
    if (!porHora[hora]) porHora[hora] = { landing: 0, register: 0 }
    if (v.pagina === 'landing') porHora[hora].landing++
    if (v.pagina === 'register') porHora[hora].register++
  }

  // --- origem dispositivo (24h) ---
  const porDispositivo = { mobile: 0, desktop: 0, tablet: 0 }
  for (const v of ultimas24h || []) {
    const ua = v.user_agent_short as 'mobile' | 'desktop' | 'tablet' | null
    if (ua && ua in porDispositivo) porDispositivo[ua]++
  }

  // --- referrers top (7 dias) ---
  const referrers: Record<string, number> = {}
  for (const v of ultimos7d || []) {
    const ref = (v as { referrer?: string }).referrer || ''
    if (!ref) continue
    try {
      const u = new URL(ref)
      const host = u.host
      referrers[host] = (referrers[host] || 0) + 1
    } catch { /* */ }
  }
  const referrersTop = Object.entries(referrers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([host, n]) => ({ host, visitas: n }))

  // --- 7d resumo ---
  const sete = ultimos7d || []
  const seteLanding = sete.filter(v => v.pagina === 'landing').length
  const seteRegister = sete.filter(v => v.pagina === 'register').length

  // --- 30d resumo (separado pra economizar bytes) ---
  const { data: ultimos30d } = await supabase
    .from('visitas')
    .select('pagina, sessao')
    .gte('criado_em', trintaDiasAtras.toISOString())
  const trinta = ultimos30d || []
  const trintaLanding = trinta.filter(v => v.pagina === 'landing').length
  const trintaRegister = trinta.filter(v => v.pagina === 'register').length
  const trintaLandingUnicos = new Set(trinta.filter(v => v.pagina === 'landing').map(v => v.sessao).filter(Boolean)).size
  const trintaRegisterUnicos = new Set(trinta.filter(v => v.pagina === 'register').map(v => v.sessao).filter(Boolean)).size

  return NextResponse.json({
    hoje: {
      landing_total: hojeLanding,
      landing_unicos: hojeLandingUnicos,
      register_total: hojeRegister,
      register_unicos: hojeRegisterUnicos,
      conversao_landing_para_register_pct: Number(conversaoHoje.toFixed(1)),
    },
    ultimos_7d: {
      landing_total: seteLanding,
      register_total: seteRegister,
      total: sete.length,
      conversao_pct: seteLanding > 0 ? Number(((seteRegister / seteLanding) * 100).toFixed(1)) : 0,
    },
    ultimos_30d: {
      landing_total: trintaLanding,
      landing_unicos: trintaLandingUnicos,
      register_total: trintaRegister,
      register_unicos: trintaRegisterUnicos,
      total: trinta.length,
      conversao_pct: trintaLanding > 0 ? Number(((trintaRegister / trintaLanding) * 100).toFixed(1)) : 0,
    },
    por_dia_7d: Object.entries(porDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, v]) => ({
        dia,
        landing: v.landing,
        register: v.register,
        conversao_pct: v.landing > 0 ? Number(((v.register / v.landing) * 100).toFixed(1)) : 0,
      })),
    por_hora_24h: Object.entries(porHora)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, v]) => ({ hora, landing: v.landing, register: v.register })),
    por_dispositivo_24h: porDispositivo,
    referrers_top_7d: referrersTop,
    total_24h: (ultimas24h || []).length,
  })
}
