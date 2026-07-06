// Audit log de ações admin. Best-effort: nunca quebra a request.
//
// Uso típico em um endpoint:
//   await logAdminAction({ request, acao: 'aprovar_revendedora', alvo: id })
//
// O `quem` é resolvido automaticamente via getAdminUser(request).
// `quemOverride` existe pra casos específicos (ex: login) onde o cookie
// ainda não foi setado quando a request entra.

import { supabaseAdmin } from './supabaseAdmin'
import { getAdminUser, type AdminUser } from './adminAuth'

type LogArgs = {
  request: Request
  acao: string
  alvo?: string | null
  detalhes?: Record<string, unknown> | null
  quemOverride?: AdminUser
}

export async function logAdminAction(args: LogArgs): Promise<void> {
  const quem = args.quemOverride || getAdminUser(args.request)
  if (!quem) return // não logado → nada pra logar

  const ip =
    args.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    args.request.headers.get('x-real-ip') ||
    null
  const userAgent = args.request.headers.get('user-agent') || null

  try {
    await supabaseAdmin()
      .from('admin_audit_log')
      .insert({
        quem,
        acao: args.acao,
        alvo: args.alvo ?? null,
        detalhes: args.detalhes ?? null,
        ip,
        user_agent: userAgent,
      })
  } catch (e) {
    console.error('[admin_audit_log] insert falhou:', e)
  }
}
