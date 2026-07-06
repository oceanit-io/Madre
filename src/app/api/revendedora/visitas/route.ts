// GET /api/revendedora/visitas — visitas à loja da revendedora logada.
// Retorna { hoje, ultimos_7d } contando registros de `visitas` com
// pagina = 'loja/<subdominio>'. Dia em horário de Brasília (UTC-3).

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const { rev, admin } = sessao

  const pagina = `loja/${rev.subdominio}`.slice(0, 40)

  // Início do dia em Brasília (UTC-3): 00:00 BRT = 03:00 UTC.
  const agora = new Date()
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000)
  const inicioHoje = new Date(
    Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0)
  )
  const inicio7d = new Date(inicioHoje.getTime() - 6 * 24 * 3600 * 1000)

  const { data, error } = await admin
    .from('visitas')
    .select('criado_em')
    .eq('pagina', pagina)
    .gte('criado_em', inicio7d.toISOString())

  if (error) {
    return NextResponse.json({ hoje: 0, ultimos_7d: 0 })
  }

  const rows = data || []
  const hoje = rows.filter(
    r => new Date(r.criado_em as string) >= inicioHoje
  ).length

  return NextResponse.json({ hoje, ultimos_7d: rows.length })
}
