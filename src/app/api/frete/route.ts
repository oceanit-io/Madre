import { NextResponse } from 'next/server'
import { calcularFretes } from '@/lib/frete'

export const dynamic = 'force-dynamic'

// POST /api/frete
// Body: { uf: "SP", cep: "01310100", subtotal: 199, qntItens: 2 }
// Resp: { regiao, opcoes: [{servico:'PAC', valor, prazo_dias_min/max, ...}, ...] }
export async function POST(request: Request) {
  let body: { uf?: string; cep?: string; subtotal?: number; qntItens?: number }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const uf = (body.uf || '').trim().toUpperCase()
  const subtotal = Number(body.subtotal) || 0
  const cep = (body.cep || '').toString().replace(/\D/g, '')
  const qntItens = Math.max(1, Number(body.qntItens) || 1)

  if (uf.length !== 2) {
    return NextResponse.json({ erro: 'UF inválida' }, { status: 400 })
  }

  const resultado = await calcularFretes(uf, cep, subtotal, qntItens)
  return NextResponse.json(resultado)
}
