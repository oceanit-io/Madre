import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

const SG_BASE_URL = 'http://sgps.sgsistemas.com.br:8201/integracao/sgsistemas/v1'

async function getToken() {
  const res = await fetch(`${SG_BASE_URL}/autorizacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: process.env.SG_USUARIO,
      senha: process.env.SG_SENHA,
    }),
  })
  const data = await res.json()
  return data.token || data.access_token || data.accessToken
}

export async function GET(request: Request) {
  // Proxy pro ERP SG com credenciais do servidor — só admin. Antes era aberto.
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '3'
    const filial = searchParams.get('filial') || '1'

    const token = await getToken()
    if (!token) {
      return NextResponse.json({ erro: 'Falha ao obter token' }, { status: 500 })
    }

    const url = `${SG_BASE_URL}/produtos?filial=${filial}&limit=${limit}`

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { erro: 'SG retornou resposta não-JSON', status: res.status, resposta: text.slice(0, 500) },
        { status: 500 }
      )
    }

    if (!res.ok) {
      return NextResponse.json({ erro: 'Falha na busca', status: res.status, detalhes: data, url_chamada: url }, { status: res.status })
    }

    return NextResponse.json({ sucesso: true, total: Array.isArray(data) ? data.length : '?', filial_usada: filial, produtos: data })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}