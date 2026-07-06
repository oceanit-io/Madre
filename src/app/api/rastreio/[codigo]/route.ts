// GET /api/rastreio/[codigo] — eventos reais do objeto nos Correios (SRO).
// Público: o cliente final acompanha o pedido sem login (o código já é dele).
// Best-effort: se a integração estiver indisponível, devolve eventos:[] +
// disponivel:false e a UI mostra o link público dos Correios.

import { NextResponse } from 'next/server'
import { rastrearObjeto, linkRastreamentoCorreios } from '@/lib/correios'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { codigo: string } }
) {
  const codigo = (params.codigo || '').trim().toUpperCase()

  // Validação leve de formato pra não martelar a API dos Correios com lixo.
  // Padrão típico: 2 letras + 9 dígitos + BR. Aceita variações curtas, barra
  // só absurdos.
  if (codigo.length < 8 || codigo.length > 20 || !/^[A-Z0-9]+$/.test(codigo)) {
    return NextResponse.json({ erro: 'Código de rastreio inválido' }, { status: 400 })
  }

  const eventos = await rastrearObjeto(codigo)

  return NextResponse.json({
    codigo,
    link: linkRastreamentoCorreios(codigo),
    eventos: eventos || [],
    // false = integração indisponível (sem credenciais/erro) → UI usa o link.
    disponivel: eventos !== null,
  })
}
