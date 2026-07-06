// Referência real da peça (ex "CESTA17-4"), buscada do HTML público da Tray.
// Lazy + cache: 1ª chamada busca e grava em produtos.referencia; depois
// retorna do cache. Best-effort — nunca quebra a página.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarReferenciaTray } from '@/lib/trayReferencia'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseAdmin()
  const { data: produto, error } = await supabase
    .from('produtos')
    .select('id, sku, referencia')
    .eq('id', params.id)
    .single()

  if (error || !produto) {
    return NextResponse.json({ referencia: null }, { status: 404 })
  }

  // Cache hit
  if (produto.referencia) {
    return NextResponse.json({ referencia: produto.referencia, cached: true })
  }

  // Miss: busca no HTML público e cacheia (fire-and-forget)
  const ref = await buscarReferenciaTray(produto.sku)
  if (ref) {
    supabase.from('produtos').update({ referencia: ref }).eq('id', produto.id).then(() => {})
  }
  return NextResponse.json({ referencia: ref, cached: false })
}
