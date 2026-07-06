// Cliente admin (service_role) com FETCH CACHE DESATIVADO.
//
// Por que existe: o supabase-js usa `fetch` por baixo. Next.js 14
// cacheia fetches por URL — e queries do PostgREST com filtros fixos
// (ex: `?status=eq.pendente`) têm URL repetida. Resultado: a primeira
// resposta fica cacheada e fica STALE depois de updates (ex.: a
// revendedora foi ativada, mas o admin segue vendo ela como pendente).
//
// `export const dynamic = 'force-dynamic'` no route handler controla a
// resposta da rota, mas NÃO afeta os fetches internos do supabase-js.
// Aqui passamos um fetch wrapper que força `cache: 'no-store'` em todas
// as chamadas que esse cliente faz.
//
// Use isso em todas as rotas admin/server que precisem dados frescos.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}
