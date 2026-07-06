import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('revendedoras')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) {
    return NextResponse.json({ erro: 'Erro ao buscar revendedoras', detalhes: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
