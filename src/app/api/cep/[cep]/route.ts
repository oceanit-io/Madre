import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { cep: string } }
) {
  const cep = (params.cep || '').replace(/\D/g, '')

  if (cep.length !== 8) {
    return NextResponse.json({ erro: 'CEP inválido' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ erro: 'CEP não encontrado' }, { status: 404 })
    }

    const data = await res.json()

    if (data?.erro) {
      return NextResponse.json({ erro: 'CEP não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    })
  } catch (e) {
    return NextResponse.json(
      { erro: 'Erro ao consultar o CEP' },
      { status: 502 }
    )
  }
}
