// GET /api/admin/me → { quem: 'gabby' | 'anderson' | 'escritorio' | 'master' }
// Usado pelo header de TODAS as páginas admin pra mostrar "Logado: X".

import { NextResponse } from 'next/server'
import { getAdminUser, getAdminRole } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const quem = getAdminUser(request)
  if (!quem) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  return NextResponse.json({ quem, role: getAdminRole(request) })
}
