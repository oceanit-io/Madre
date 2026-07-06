import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { faturamentoValor } from '@/lib/recebedorValidacao'
import { truncarHolderName } from '@/lib/pagarmeRecipient'

export const dynamic = 'force-dynamic'

// Endpoint de debug: pega o rascunho de recebedor de uma revendedora,
// monta o payload exato, dispara pro Pagar.me e devolve a resposta CRUA
// (status HTTP, body do Pagar.me, payload enviado com dados sensíveis
// mascarados). Permite ver exatamente qual campo está reclamando.
//
// GET /api/admin/recebedor-test?slug=gabrielafernandez-5034
//   Authorization: Bearer prata925
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const slug = new URL(request.url).searchParams.get('slug') || ''
  if (!slug) {
    return NextResponse.json({ erro: 'use ?slug=...' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: rev } = await admin
    .from('revendedoras')
    .select('nome, email, pagarme_recipient_data')
    .eq('subdominio', slug)
    .single()

  if (!rev) {
    return NextResponse.json({ erro: `revendedora "${slug}" não encontrada` }, { status: 404 })
  }
  const r = (rev.pagarme_recipient_data || {}) as Record<string, string>
  if (!r.documento) {
    return NextResponse.json({ erro: 'Rascunho vazio ou sem documento — preencha o form primeiro' }, { status: 400 })
  }

  // Constrói o payload exatamente como o /api/revendedora/recebedor faz.
  const documento = (r.documento || '').replace(/\D/g, '')
  const tipo: 'individual' | 'company' = r.tipo === 'company' ? 'company' : 'individual'
  const monthlyIncomeCents = Math.round((faturamentoValor(r.faturamento_id) || 1000) * 100)

  const phoneNumbers: Array<Record<string, string>> = []
  const ddd = (r.telefone_ddd || '').replace(/\D/g, '')
  const tnum = (r.telefone_numero || '').replace(/\D/g, '')
  if (ddd.length === 2 && tnum.length >= 8) {
    phoneNumbers.push({
      ddd: ddd,
      number: tnum,
      type: (r.tipo_telefone as string) || 'mobile',
    })
  }

  const address = {
    street: r.logradouro,
    street_number: r.numero,
    complementary: r.complemento || undefined,
    neighborhood: r.bairro,
    city: r.cidade,
    state: r.uf,
    zip_code: (r.cep || '').replace(/\D/g, ''),
    reference_point: r.referencia || undefined,
  }

  const registerInformation: Record<string, unknown> = tipo === 'individual'
    ? {
        type: 'individual',
        email: r.email,
        document: documento,
        name: r.nome,
        site_url: r.site || undefined,
        phone_numbers: phoneNumbers,
        address,
        mother_name: r.nome_mae,
        birthdate: r.data_nascimento || '', // já vem DD/MM/AAAA do form
        monthly_income: monthlyIncomeCents,
        professional_occupation: r.ocupacao,
      }
    : {
        type: 'corporation',
        email: r.email,
        document: documento,
        company_name: r.nome,
        trading_name: r.nome,
        site_url: r.site || undefined,
        phone_numbers: phoneNumbers,
        address,
        annual_revenue: monthlyIncomeCents * 12,
      }

  const titularTipo: 'individual' | 'company' = r.titular_tipo === 'company' ? 'company' : 'individual'

  const body = {
    description: r.descricao || `Recebedor ${r.nome}`.slice(0, 256),
    register_information: registerInformation,
    default_bank_account: {
      holder_name: truncarHolderName(r.titular_nome || ''),
      holder_type: titularTipo,
      holder_document: (r.titular_documento || '').replace(/\D/g, ''),
      bank: (r.banco || '').replace(/\D/g, '').padStart(3, '0'),
      branch_number: (r.agencia || '').replace(/\D/g, ''),
      branch_check_digit: r.agencia_digito || undefined,
      account_number: (r.conta || '').replace(/\D/g, ''),
      account_check_digit: r.conta_digito,
      type: r.tipo_conta,
    },
    transfer_settings: {
      transfer_enabled: true,
      transfer_interval: 'daily',
      transfer_day: 0,
    },
  }

  // Chama Pagar.me
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) {
    return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  }
  const authHeader = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  let resp: Response
  let raw = ''
  try {
    resp = await fetch(`${BASE}/recipients`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    raw = await resp.text().catch(() => '')
  } catch (e) {
    return NextResponse.json({
      erro: 'Erro de rede com Pagar.me',
      detalhe: e instanceof Error ? e.message : String(e),
    }, { status: 502 })
  }

  let json: unknown = null
  try { json = raw ? JSON.parse(raw) : null } catch { /* deixa raw */ }

  // Mascara dados sensíveis no payload retornado pra log seguro.
  function mask(s: string): string {
    const c = (s || '').replace(/\D/g, '')
    if (c.length <= 4) return '***'
    return c.slice(0, 3) + '***' + c.slice(-2)
  }
  const payloadEnviado = {
    ...body,
    register_information: {
      ...registerInformation,
      document: mask(documento),
    },
    default_bank_account: {
      ...body.default_bank_account,
      account_number: '***',
      holder_document: mask(body.default_bank_account.holder_document),
    },
  }

  return NextResponse.json({
    pagarme: {
      status_http: resp.status,
      ok: resp.ok,
      response: json,
      raw_preview: raw.slice(0, 2500),
    },
    payload_enviado: payloadEnviado,
  })
}
