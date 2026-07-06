// GET /api/admin/session — devolve { autenticado: bool }
// Client usa pra saber se já tem cookie válido (o cookie é HttpOnly → JS
// não consegue ler direto).

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return NextResponse.json({ autenticado: checkAdminAuth(request) })
}
