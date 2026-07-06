import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'
import { criarRecipientPagarme, pagarmeRecipientPodeSubmeter } from '@/lib/pagarmeRecipient'
import {
  validarDocumento, validarCEP, validarDDD, validarTelefone,
  validarCodigoBanco, validarAgencia, validarConta,
  validarData, dataParaISO, faturamentoValido, faturamentoValor,
  tipoContaValido,
} from '@/lib/recebedorValidacao'

export const dynamic = 'force-dynamic'

// Shape do rascunho salvo em revendedoras.pagarme_recipient_data (jsonb).
type RecebedorRascunho = {
  tipo: 'individual' | 'company'
  // Identificação
  nome: string
  email: string
  descricao?: string
  documento: string       // só dígitos
  site?: string
  data_nascimento?: string // DD/MM/AAAA (PF apenas)
  ocupacao?: string
  nome_mae?: string        // PF apenas
  faturamento_id?: string  // ID da faixa em FAIXAS_FATURAMENTO
  // Telefone
  tipo_telefone?: 'mobile' | 'home' | 'work'
  telefone_ddd?: string    // 2 dígitos
  telefone_numero?: string // 8 ou 9 dígitos
  // Endereço
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  referencia?: string
  // Conta bancária
  banco?: string           // código 3 dígitos
  agencia?: string
  agencia_digito?: string
  conta?: string
  conta_digito?: string
  tipo_conta?: string
  titular_nome?: string
  titular_tipo?: 'individual' | 'company'
  titular_documento?: string
}

// GET: retorna o rascunho atual + status do KYC + fallback com dados
// que já temos da revendedora (nome, email, telefone, cidade, UF) pro
// form pré-preencher sem ela ter que redigitar.
export async function GET(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const { rev, admin } = sessao

  const { data } = await admin
    .from('revendedoras')
    .select('nome, email, whatsapp, cidade, estado, pagarme_recipient_id, pagarme_recipient_status, pagarme_recipient_data')
    .eq('id', rev.id)
    .single()

  // Fallback: parseia whatsapp em DDD + número (assume formato 11 9XXXX-XXXX
  // ou 11 XXXX-XXXX). Pega os 2 primeiros dígitos como DDD.
  const waLimpo = ((data?.whatsapp as string) || '').replace(/\D/g, '')
  const fallback = {
    nome: (data?.nome as string) || '',
    email: (data?.email as string) || '',
    telefone_ddd: waLimpo.slice(0, 2),
    telefone_numero: waLimpo.slice(2),
    cidade: (data?.cidade as string) || '',
    uf: ((data?.estado as string) || '').toUpperCase().slice(0, 2),
  }

  return NextResponse.json({
    recipient_id: data?.pagarme_recipient_id || null,
    status: data?.pagarme_recipient_status || null,
    rascunho: data?.pagarme_recipient_data || null,
    fallback,
  })
}

// POST: salva rascunho parcial OU submete pra Pagar.me (com ?submit=1).
// Rascunho aceita campos incompletos; submit valida todos.
export async function POST(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const { rev, admin } = sessao
  const submit = new URL(request.url).searchParams.get('submit') === '1'

  let body: Partial<RecebedorRascunho>
  try { body = await request.json() } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  // Sanitização: remove caracteres estranhos, trim. Não rejeita
  // rascunho incompleto.
  const rascunho: Partial<RecebedorRascunho> = {
    tipo: body.tipo === 'company' ? 'company' : 'individual',
    nome: (body.nome || '').trim().slice(0, 120),
    email: (body.email || '').trim().toLowerCase().slice(0, 80),
    descricao: (body.descricao || '').trim().slice(0, 200) || undefined,
    documento: (body.documento || '').replace(/\D/g, ''),
    site: (body.site || '').trim().slice(0, 100) || undefined,
    data_nascimento: (body.data_nascimento || '').trim().slice(0, 10) || undefined,
    ocupacao: (body.ocupacao || '').trim().slice(0, 100) || undefined,
    nome_mae: (body.nome_mae || '').trim().slice(0, 120) || undefined,
    faturamento_id: body.faturamento_id || undefined,
    tipo_telefone: ['mobile', 'home', 'work'].includes(String(body.tipo_telefone))
      ? body.tipo_telefone : 'mobile',
    telefone_ddd: (body.telefone_ddd || '').replace(/\D/g, '').slice(0, 2),
    telefone_numero: (body.telefone_numero || '').replace(/\D/g, '').slice(0, 9),
    cep: (body.cep || '').replace(/\D/g, '').slice(0, 8),
    logradouro: (body.logradouro || '').trim().slice(0, 120),
    numero: (body.numero || '').trim().slice(0, 20),
    complemento: (body.complemento || '').trim().slice(0, 80) || undefined,
    bairro: (body.bairro || '').trim().slice(0, 80),
    cidade: (body.cidade || '').trim().slice(0, 80),
    uf: (body.uf || '').trim().toUpperCase().slice(0, 2),
    referencia: (body.referencia || '').trim().slice(0, 120) || undefined,
    banco: (body.banco || '').replace(/\D/g, '').slice(0, 3),
    agencia: (body.agencia || '').replace(/\D/g, '').slice(0, 6),
    agencia_digito: (body.agencia_digito || '').replace(/\D/g, '').slice(0, 2) || undefined,
    conta: (body.conta || '').replace(/\D/g, '').slice(0, 13),
    conta_digito: (body.conta_digito || '').replace(/\D/g, '').slice(0, 2),
    tipo_conta: body.tipo_conta,
    titular_nome: (body.titular_nome || '').trim().slice(0, 120),
    titular_tipo: body.titular_tipo === 'company' ? 'company' : 'individual',
    titular_documento: (body.titular_documento || '').replace(/\D/g, ''),
  }

  // ---------- Caminho 1: salvar rascunho ----------
  if (!submit) {
    const { error } = await admin
      .from('revendedoras')
      .update({
        pagarme_recipient_data: rascunho,
        // Só vira 'draft' se ainda não foi enviado pra Pagar.me.
        pagarme_recipient_status: rev.pagarme_recipient_id ? rev.pagarme_recipient_status : 'draft',
      })
      .eq('id', rev.id)
    if (error) {
      return NextResponse.json({ erro: 'Erro ao salvar rascunho', detalhe: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, status: 'draft' })
  }

  // ---------- Caminho 2: validar tudo + submeter ----------
  const erros: Record<string, string> = {}
  const r = rascunho as Required<RecebedorRascunho>

  if (r.nome.length < 3) erros.nome = 'Nome completo é obrigatório'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) erros.email = 'E-mail inválido'
  if (!validarDocumento(r.documento)) erros.documento = 'CPF ou CNPJ inválido'
  if (r.tipo === 'individual' && r.documento.length !== 11) erros.documento = 'Pessoa Física exige CPF'
  if (r.tipo === 'company'    && r.documento.length !== 14) erros.documento = 'Pessoa Jurídica exige CNPJ'
  if (r.tipo === 'individual') {
    if (!r.data_nascimento || !validarData(r.data_nascimento)) erros.data_nascimento = 'Data inválida ou menor de 18'
    if (!r.nome_mae || r.nome_mae.length < 3) erros.nome_mae = 'Nome da mãe é obrigatório'
  }
  if (!r.ocupacao || r.ocupacao.length < 3) erros.ocupacao = 'Profissão é obrigatória'
  if (!faturamentoValido(r.faturamento_id)) erros.faturamento_id = 'Selecione uma faixa'
  if (!validarDDD(r.telefone_ddd)) erros.telefone_ddd = 'DDD inválido'
  if (!validarTelefone(r.telefone_numero)) erros.telefone_numero = 'Telefone inválido'
  if (!validarCEP(r.cep)) erros.cep = 'CEP inválido'
  if (!r.logradouro) erros.logradouro = 'Logradouro obrigatório'
  if (!r.numero) erros.numero = 'Número obrigatório'
  if (!r.bairro) erros.bairro = 'Bairro obrigatório'
  if (!r.cidade) erros.cidade = 'Cidade obrigatória'
  if (r.uf.length !== 2) erros.uf = 'UF inválida'
  if (!validarCodigoBanco(r.banco)) erros.banco = 'Banco inválido'
  if (!validarAgencia(r.agencia)) erros.agencia = 'Agência inválida'
  if (!validarConta(r.conta)) erros.conta = 'Conta inválida'
  if (!r.conta_digito) erros.conta_digito = 'Dígito da conta obrigatório'
  if (!tipoContaValido(r.tipo_conta)) erros.tipo_conta = 'Selecione o tipo de conta'
  if (!r.titular_nome || r.titular_nome.length < 3) erros.titular_nome = 'Nome do titular obrigatório'
  if (!validarDocumento(r.titular_documento)) erros.titular_documento = 'Documento do titular inválido'

  if (Object.keys(erros).length > 0) {
    return NextResponse.json({ erro: 'Dados incompletos', campos: erros }, { status: 400 })
  }

  // Guard: se Pagar.me secret key não está setada, não podemos submeter
  // — salva como draft com aviso pro front mostrar mensagem clara.
  if (!pagarmeRecipientPodeSubmeter()) {
    await admin
      .from('revendedoras')
      .update({ pagarme_recipient_data: rascunho, pagarme_recipient_status: 'draft' })
      .eq('id', rev.id)
    return NextResponse.json({
      erro: 'Integração Pagar.me indisponível no momento. Seu cadastro foi salvo como rascunho e será enviado em breve.',
    }, { status: 503 })
  }

  // ---------- Submete pra Pagar.me ----------
  const resultado = await criarRecipientPagarme({
    nome: r.nome,
    email: r.email,
    descricao: r.descricao,
    documento: r.documento,
    tipo: r.tipo,
    site: r.site,
    dataNascimentoISO: dataParaISO(r.data_nascimento || '') || undefined,
    ocupacao: r.ocupacao,
    nomeMae: r.nome_mae,
    faturamentoMensal: faturamentoValor(r.faturamento_id),
    tipoTelefone: r.tipo_telefone,
    telefoneDDD: r.telefone_ddd,
    telefoneNumero: r.telefone_numero,
    endereco: {
      cep: r.cep, logradouro: r.logradouro, numero: r.numero,
      complemento: r.complemento, bairro: r.bairro, cidade: r.cidade,
      uf: r.uf, referencia: r.referencia,
    },
    contaBancaria: {
      banco: r.banco,
      agencia: r.agencia,
      agenciaDigito: r.agencia_digito,
      conta: r.conta,
      contaDigito: r.conta_digito,
      tipo: r.tipo_conta as 'checking' | 'savings' | 'checking_joint' | 'savings_joint',
      titularNome: r.titular_nome,
      titularTipo: r.titular_tipo,
      titularDocumento: r.titular_documento,
    },
  })

  if (resultado.ok === false) {
    // Mantém rascunho local pra a revendedora corrigir e tentar de novo.
    await admin
      .from('revendedoras')
      .update({ pagarme_recipient_data: rascunho, pagarme_recipient_status: 'draft' })
      .eq('id', rev.id)
    return NextResponse.json(
      { erro: resultado.erro, detalhes: resultado.detalhes },
      { status: resultado.status || 500 },
    )
  }

  // Sucesso: salva ID + status retornado pela Pagar.me.
  await admin
    .from('revendedoras')
    .update({
      pagarme_recipient_id: resultado.recipientId,
      pagarme_recipient_status: resultado.status,
      pagarme_recipient_data: rascunho,
    })
    .eq('id', rev.id)

  return NextResponse.json({
    ok: true,
    recipient_id: resultado.recipientId,
    status: resultado.status,
  })
}
