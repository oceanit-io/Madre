// Valida la sesión de Supabase del lado server (token en Authorization:
// Bearer <access_token>) y resuelve la revendedora asociada usando
// service_role. La tabla `comissoes` tiene RLS restrictivo (solo
// service_role), por eso los datos se sirven vía API, no por query directa
// del browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type RevendedoraSessao = {
  userId: string
  rev: {
    id: string
    nome: string
    nome_loja: string | null
    subdominio: string
    status: string
    saldo_disponivel: number
    saldo_processando: number
    total_ganho: number
    total_vendas: number
    pagarme_recipient_id: string | null
    pagarme_recipient_status: string | null
  }
  admin: SupabaseClient
}

export async function getRevendedoraFromRequest(
  request: Request
): Promise<RevendedoraSessao | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''
  if (!token) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Cliente anon con el token del usuario solo para validar la sesión.
  // Sin cache de Next.js — getUser tem que checar o token vivo.
  const anon = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error,
  } = await anon.auth.getUser()
  if (error || !user) return null

  // Cliente service_role com cache desativado (ver lib/supabaseAdmin.ts).
  const admin = supabaseAdmin()

  const { data: rev } = await admin
    .from('revendedoras')
    .select(
      'id, nome, nome_loja, subdominio, status, saldo_disponivel, saldo_processando, total_ganho, total_vendas, pagarme_recipient_id, pagarme_recipient_status'
    )
    .eq('user_id', user.id)
    .single()

  if (!rev) return null

  return {
    userId: user.id,
    rev: {
      id: rev.id,
      nome: rev.nome,
      nome_loja: rev.nome_loja,
      subdominio: rev.subdominio,
      status: rev.status,
      saldo_disponivel: Number(rev.saldo_disponivel || 0),
      saldo_processando: Number(rev.saldo_processando || 0),
      total_ganho: Number(rev.total_ganho || 0),
      total_vendas: Number(rev.total_vendas || 0),
      pagarme_recipient_id: (rev.pagarme_recipient_id as string) || null,
      pagarme_recipient_status: (rev.pagarme_recipient_status as string) || null,
    },
    admin,
  }
}
