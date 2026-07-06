import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('revendedoras')
    .select('id, nome, email, whatsapp, cidade, estado, criado_em')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })

  if (error) {
    return NextResponse.json({ erro: 'Erro ao buscar pendentes', detalhes: error.message }, { status: 500 })
  }

  const res = NextResponse.json(data || [])
  res.headers.set('Cache-Control', 'no-store, must-revalidate')
  return res
}