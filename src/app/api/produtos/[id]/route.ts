import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }

  if (!data.ativo) {
    return NextResponse.json({ erro: 'Produto inativo' }, { status: 403 })
  }

  return NextResponse.json(data)
}