import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }

  let body: { destaque?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  if (typeof body.destaque !== 'boolean') {
    return NextResponse.json(
      { erro: 'Campo destaque (boolean) obrigatório' },
      { status: 400 }
    )
  }

  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('produtos')
    .update({ destaque: body.destaque })
    .eq('id', params.id)
    .select('id, destaque')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar', detalhes: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data.id, destaque: data.destaque })
}
