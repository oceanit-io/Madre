// GET /api/admin/revalidate — força a Vercel CDN a invalidar TODO o
// cache de /admin/* e /dashboard. Sem isso, HTML cacheado fica preso
// por horas mesmo com no-store no middleware.
//
// Uso: visita a URL logada (cookie admin), vê { revalidated: true } e
// no próximo refresh as páginas vêm fresh.

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const paths = [
    '/admin',
    '/admin/pedidos',
    '/admin/ativar',
    '/admin/vendas',
    '/admin/saldos',
    '/admin/saques',
    '/admin/revendedoras',
    '/admin/financeiro',
    '/admin/graficos',
    '/admin/mensalidades',
    '/admin/destaques',
    '/admin/relatorio-tray',
    '/dashboard',
  ]

  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch (e) {
      console.error('[revalidate]', p, e)
    }
  }

  return NextResponse.json({
    revalidated: true,
    paths,
    timestamp: new Date().toISOString(),
  })
}
