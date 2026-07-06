// PATCH /api/revendedora/perfil — atualiza dados pessoais visíveis pra cliente.
//
// Campos editáveis pela própria revendedora:
//   - nome             (string, 2-80 chars)
//   - whatsapp         (string, só dígitos, 10-13 chars)
//   - cidade           (string, 2-60 chars)
//   - estado           (string, 2 chars UF)
//
// NÃO editável aqui:
//   - email   → trocar exige fluxo admin (afeta auth.users)
//   - status  → controlado por pagamento/admin
//   - status financeiros, saldos, comissões
//   - nome_loja / subdominio → editar em /configurar-loja

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

export async function PATCH(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: {
    nome?: string
    whatsapp?: string
    cidade?: string
    estado?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const update: Record<string, string> = {}

  if (body.nome !== undefined) {
    const nome = (body.nome || '').trim()
    if (nome.length < 2 || nome.length > 80) {
      return NextResponse.json({ erro: 'Nome deve ter entre 2 e 80 caracteres' }, { status: 400 })
    }
    update.nome = nome
  }

  if (body.whatsapp !== undefined) {
    // Aceita formato brasileiro com ou sem máscara. Guarda só dígitos.
    const digits = (body.whatsapp || '').replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) {
      return NextResponse.json({ erro: 'WhatsApp inválido (DDD + número, ex: 11987654321)' }, { status: 400 })
    }
    update.whatsapp = digits
  }

  if (body.cidade !== undefined) {
    const cidade = (body.cidade || '').trim()
    if (cidade.length < 2 || cidade.length > 60) {
      return NextResponse.json({ erro: 'Cidade deve ter entre 2 e 60 caracteres' }, { status: 400 })
    }
    update.cidade = cidade
  }

  if (body.estado !== undefined) {
    const estado = (body.estado || '').trim().toUpperCase()
    if (!UFS.has(estado)) {
      return NextResponse.json({ erro: 'UF inválida (use 2 letras: SP, RJ, MG, etc)' }, { status: 400 })
    }
    update.estado = estado
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ erro: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await sessao.admin
    .from('revendedoras')
    .update(update)
    .eq('id', sessao.rev.id)
    .select('nome, whatsapp, cidade, estado')
    .single()

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao salvar', detalhes: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
