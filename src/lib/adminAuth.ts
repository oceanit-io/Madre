// ⚠️ Server-only. NÃO importar deste arquivo a partir de Client Components.
// Os PINs NUNCA vão pro bundle do navegador.
//
// Multi-user (introduzido jun/2026):
//   - Cada pessoa tem PIN próprio em env separado:
//       ADMIN_PIN_GABBY, ADMIN_PIN_ANDERSON, ADMIN_PIN_ESCRITORIO
//   - ADMIN_PIN é mantido como fallback "master" pra curl/Bearer/diagnóstico.
//   - No login, o PIN digitado identifica QUEM é (gabby/anderson/escritorio/master).
//   - Cookie HttpOnly guarda o identificador (não o PIN). Valor é uma das
//     strings curtas allowed — sem chars especiais, sem URL-encoding zoado.
//   - Auditoria (admin_audit_log) usa getAdminUser(request) pra logar quem.

// 'viewer' = acesso SOMENTE LEITURA: vê métricas/dados, mas o middleware
// bloqueia qualquer escrita (POST/PATCH/PUT/DELETE) em /api/admin.
import { hmacSha256Hex, timingSafeEqualHex } from './adminCookieSig'

export type AdminUser = 'gabby' | 'anderson' | 'escritorio' | 'master' | 'viewer'
export type AdminRole = 'full' | 'viewer'

const ADMIN_COOKIE_NAME = 'lp925_admin'
const VALID_USERS: AdminUser[] = ['gabby', 'anderson', 'escritorio', 'master', 'viewer']

// Segredo p/ ASSINAR o cookie admin. Antes o cookie era o identificador em
// texto plano (`master`) — qualquer um forjava `Cookie: lp925_admin=master`
// e tinha acesso total. Agora o cookie é `user.HMAC(user)` e só vale se a
// assinatura bater. Use ADMIN_COOKIE_SECRET no Vercel; sem ela, deriva um
// segredo estável do PIN master (sem expor o PIN, via HMAC).
function cookieSecret(): string {
  const explicit = process.env.ADMIN_COOKIE_SECRET
  if (explicit) return explicit
  const base = process.env.ADMIN_PIN || process.env.ADMIN_PIN_GABBY || 'lp925-admin'
  return hmacSha256Hex(base, 'lp925-admin-cookie-secret-v1')
}

/** Valor assinado do cookie pra um usuário: `user.HMAC(user)`. */
export function makeAdminCookieValue(user: AdminUser): string {
  return `${user}.${hmacSha256Hex(cookieSecret(), user)}`
}

function readPins(): Record<AdminUser, string | null> {
  return {
    gabby: process.env.ADMIN_PIN_GABBY || null,
    anderson: process.env.ADMIN_PIN_ANDERSON || null,
    escritorio: process.env.ADMIN_PIN_ESCRITORIO || null,
    master: process.env.ADMIN_PIN || null,
    viewer: process.env.ADMIN_PIN_VIEWER || null,
  }
}

/** Retorna QUEM é dado um PIN cru. null se não bate com nenhum. */
export function identifyUserFromPin(input: string): AdminUser | null {
  if (!input) return null
  const pins = readPins()
  for (const user of VALID_USERS) {
    const pin = pins[user]
    if (pin && pin === input) return user
  }
  return null
}

/** Confere se o PIN bate com algum dos configurados. */
export function validatePin(input: string): boolean {
  return identifyUserFromPin(input) !== null
}

function parseCookie(cookieHeader: string): AdminUser | null {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`))
  if (!m) return null
  const raw = m[1].trim()
  // Formato assinado: `user.HMAC`. Sem o ponto/assinatura = cookie antigo em
  // texto plano ou forjado → REJEITA (a pessoa só precisa logar de novo).
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const user = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!VALID_USERS.includes(user as AdminUser)) return null
  const esperado = hmacSha256Hex(cookieSecret(), user)
  if (!timingSafeEqualHex(sig, esperado)) return null
  return user as AdminUser
}

/** Confere auth admin: cookie OU Bearer. Mantida pra compatibilidade. */
export function checkAdminAuth(request: Request): boolean {
  return getAdminUser(request) !== null
}

/** Retorna QUEM tá autenticado (cookie ou Bearer). null se não autenticado. */
export function getAdminUser(request: Request): AdminUser | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const fromCookie = parseCookie(cookieHeader)
  if (fromCookie) return fromCookie

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.match(/^Bearer (.+)$/)
  if (bearer) {
    const user = identifyUserFromPin(bearer[1])
    if (user) return user
  }
  return null
}

/** Papel do admin: 'viewer' (somente leitura) ou 'full'. null se não autenticado. */
export function getAdminRole(request: Request): AdminRole | null {
  const user = getAdminUser(request)
  if (!user) return null
  return user === 'viewer' ? 'viewer' : 'full'
}

/** true se autenticado E somente leitura (viewer). */
export function isReadOnlyAdmin(request: Request): boolean {
  return getAdminRole(request) === 'viewer'
}

export const ADMIN_COOKIE = ADMIN_COOKIE_NAME
