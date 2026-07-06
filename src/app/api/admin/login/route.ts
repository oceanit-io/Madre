// POST /api/admin/login   body: { pin }   → seta cookie HttpOnly se OK
// DELETE /api/admin/login                 → limpa cookie (logout)
//
// O PIN é lido do env (ADMIN_PIN_GABBY/ANDERSON/ESCRITORIO ou ADMIN_PIN master).
// O cookie guarda o IDENTIFICADOR da pessoa (gabby/anderson/escritorio/master),
// nunca o PIN. Permite ao painel saber QUEM tá logado e instrumentar audit log.

import { NextResponse } from 'next/server'
import { identifyUserFromPin, ADMIN_COOKIE, makeAdminCookieValue } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { pin?: string } = {}
  try { body = await request.json() } catch { /* */ }

  const user = identifyUserFromPin(body.pin || '')
  if (!user) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, quem: user })
  res.cookies.set(ADMIN_COOKIE, makeAdminCookieValue(user), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
  })

  // Log do login — best-effort, não bloqueia resposta.
  logAdminAction({
    request,
    quemOverride: user,
    acao: 'login',
  }).catch(() => { /* nunca quebra login */ })

  return res
}

export async function DELETE(request: Request) {
  // Log do logout antes de limpar o cookie.
  logAdminAction({ request, acao: 'logout' }).catch(() => { /* */ })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
