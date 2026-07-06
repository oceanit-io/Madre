// GET /api/revendedora/meu-status
//
// Retorna o status atual da revendedora logada. Usado pelo dashboard
// pra polling: quando ela tá pendente e paga via PicPay/InfinitePay,
// a ativação pode levar minutos. Polling detecta a mudança e refresca.
//
// Resposta: { status: 'pendente' | 'ativa' | 'suspensa' }

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  // Re-busca pra pegar status atualizado (caso webhook/admin tenha ativado)
  const { data: rev } = await sessao.admin
    .from('revendedoras')
    .select('status')
    .eq('id', sessao.rev.id)
    .single()

  return NextResponse.json({
    status: rev?.status || sessao.rev.status,
  })
}
