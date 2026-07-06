// Integração com Pagar.me v5 — endpoint /core/v5/recipients.
//
// Cria um recebedor (vendedor secundário) na conta marketplace. O ID
// retornado fica salvo em revendedoras.pagarme_recipient_id e é usado
// nas regras de split de cada payment link.
//
// Docs: https://docs.pagar.me/reference/criar-um-recebedor-2

const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

export function pagarmeRecipientPodeSubmeter(): boolean {
  return !!process.env.PAGARME_SECRET_KEY
}

// Pagar.me limita holder_name a 30 chars. Corta inteligentemente: tenta
// no último espaço antes do limite pra não cortar nome no meio. Se não
// houver espaço, corta direto.
export function truncarHolderName(nome: string, max: number = 30): string {
  const t = (nome || '').trim()
  if (t.length <= max) return t
  const corte = t.lastIndexOf(' ', max)
  return corte > 0 ? t.slice(0, corte).trim() : t.slice(0, max)
}

// Converte data ISO (AAAA-MM-DD) OU DD/MM/AAAA pra DD/MM/AAAA — formato
// que o register_information.birthdate do Pagar.me exige.
function birthdateParaBR(d: string): string {
  if (!d) return ''
  // Já vem DD/MM/AAAA?
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d
  // ISO AAAA-MM-DD?
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return d
}

function authHeader(): string {
  const key = process.env.PAGARME_SECRET_KEY || ''
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

export type CriarRecipientInput = {
  // Identificação
  nome: string
  email: string
  documento: string                   // só dígitos (11 CPF ou 14 CNPJ)
  tipo: 'individual' | 'company'
  descricao?: string
  site?: string
  dataNascimentoISO?: string          // AAAA-MM-DD (PF apenas)
  ocupacao?: string
  nomeMae?: string                    // PF apenas
  faturamentoMensal?: number          // em reais

  // Telefone
  tipoTelefone?: 'mobile' | 'home' | 'work'
  telefoneDDD?: string                // 2 dígitos
  telefoneNumero?: string             // 8 ou 9 dígitos

  // Endereço
  endereco: {
    cep: string                       // 8 dígitos
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    uf: string                        // 2 letras
    referencia?: string
  }

  // Conta bancária
  contaBancaria: {
    banco: string                     // código FEBRABAN 3 dígitos
    agencia: string
    agenciaDigito?: string
    conta: string
    contaDigito: string
    tipo: 'checking' | 'savings' | 'checking_joint' | 'savings_joint'
    titularNome: string
    titularTipo: 'individual' | 'company'
    titularDocumento: string          // só dígitos
  }
}

export type CriarRecipientResultado =
  | { ok: true;  recipientId: string; status: string }
  | { ok: false; erro: string; detalhes?: unknown; status: number }

// Status retornado pelo Pagar.me (mapeado pra nosso DB):
//   active       → KYC aprovado, pode receber split
//   registration → Pagar.me pediu docs adicionais
//   refused      → KYC recusado
//   suspended    → conta suspensa
//   blocked      → bloqueada
// Mapeamos tudo o resto pra 'pending' até ter clareza.
function normalizarStatus(s: string | undefined): string {
  const v = (s || '').toLowerCase()
  if (v === 'active' || v === 'registration' || v === 'refused' ||
      v === 'suspended' || v === 'blocked' || v === 'pending') return v
  return 'pending'
}

export async function criarRecipientPagarme(
  input: CriarRecipientInput
): Promise<CriarRecipientResultado> {
  if (!pagarmeRecipientPodeSubmeter()) {
    return { ok: false, erro: 'Pagar.me não configurado', status: 503 }
  }

  // Monta o payload no shape exato da API Pagar.me v5. Telefones e
  // register_information são tratados em sub-objetos.
  const documento = input.documento.replace(/\D/g, '')
  const telefoneDDD = (input.telefoneDDD || '').replace(/\D/g, '')
  const telefoneNumero = (input.telefoneNumero || '').replace(/\D/g, '')

  // phone_numbers da Pagar.me: { ddd, number, type }
  // (Doc deles confunde — alguns lugares falam area_code/country_code mas
  // a API real exige `ddd` em register_information.phone_numbers.)
  const phoneNumbers: Array<{ ddd: string; number: string; type: string }> = []
  if (telefoneDDD.length === 2 && telefoneNumero.length >= 8) {
    phoneNumbers.push({
      ddd: telefoneDDD,
      number: telefoneNumero,
      type: input.tipoTelefone || 'mobile',
    })
  }

  // Endereço (compartilhado entre PF/PJ).
  // Pagar.me (KYC marketplace) exige `complementary` e `reference_point`
  // OBRIGATÓRIOS e NÃO-VAZIOS. Como o formulário não pede esses campos,
  // vinham `undefined` e o Pagar.me recusava ("The complementary field is
  // required" / "The reference_point field is required"), travando o KYC
  // de TODAS as revendedoras. Fallback não-vazio quando a pessoa não informa.
  const address = {
    street: input.endereco.logradouro,
    street_number: input.endereco.numero,
    complementary: (input.endereco.complemento || '').trim() || 'N/A',
    neighborhood: input.endereco.bairro,
    city: input.endereco.cidade,
    state: input.endereco.uf,
    zip_code: input.endereco.cep.replace(/\D/g, ''),
    reference_point: (input.endereco.referencia || '').trim() || 'N/A',
  }

  // Valores monetários: Pagar.me v5 usa CENTAVOS pra amounts em geral.
  // monthly_income vem em reais (ex: 5000 = R$5.000), convertemos pra cents.
  const monthlyIncomeCents = Math.round((input.faturamentoMensal || 1000) * 100)
  const annualRevenueCents = monthlyIncomeCents * 12

  // register_information varia por tipo (individual/corporation).
  const registerInformation: Record<string, unknown> = input.tipo === 'individual'
    ? {
        type: 'individual',
        email: input.email,
        document: documento,
        name: input.nome,
        site_url: input.site || undefined,
        phone_numbers: phoneNumbers,
        address,
        mother_name: input.nomeMae,
        birthdate: birthdateParaBR(input.dataNascimentoISO || ''),
        monthly_income: monthlyIncomeCents,
        professional_occupation: input.ocupacao,
      }
    : {
        type: 'corporation',
        email: input.email,
        document: documento,
        company_name: input.nome,
        trading_name: input.nome,
        site_url: input.site || undefined,
        phone_numbers: phoneNumbers,
        address,
        annual_revenue: annualRevenueCents,
      }

  // Pagar.me v5: name/email/document/type no raiz e register_information
  // são MUTUAMENTE EXCLUSIVOS. Como precisamos do KYC completo (marketplace),
  // usamos register_information e omitimos os campos raiz duplicados.
  // Description pode ficar no raiz.
  const body = {
    description: input.descricao || `Recebedor ${input.nome}`.slice(0, 256),
    register_information: registerInformation,
    default_bank_account: {
      holder_name: truncarHolderName(input.contaBancaria.titularNome),
      holder_type: input.contaBancaria.titularTipo,
      holder_document: input.contaBancaria.titularDocumento.replace(/\D/g, ''),
      bank: input.contaBancaria.banco.replace(/\D/g, '').padStart(3, '0'),
      branch_number: input.contaBancaria.agencia.replace(/\D/g, ''),
      branch_check_digit: input.contaBancaria.agenciaDigito || undefined,
      account_number: input.contaBancaria.conta.replace(/\D/g, ''),
      account_check_digit: input.contaBancaria.contaDigito,
      type: input.contaBancaria.tipo,
    },
    transfer_settings: {
      transfer_enabled: true,
      // MENSAL (não diário): a parte da revendedora no split não cai na hora —
      // transfere 1x por mês (dia 5). A Gabriela quer reter ~20-30 dias, não
      // pagar instantâneo. transfer_day = dia do mês (1-31) pra interval=monthly.
      transfer_interval: 'monthly',
      transfer_day: 5,
    },
  }

  let resp: Response
  try {
    resp = await fetch(`${BASE}/recipients`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (e) {
    console.error('[pagarme recipient] network error', e)
    return { ok: false, erro: 'Erro de rede com Pagar.me', status: 502 }
  }

  const raw = await resp.text().catch(() => '')
  let json: { id?: string; status?: string; errors?: unknown; message?: string } = {}
  try { json = raw ? JSON.parse(raw) : {} } catch { /* deixa vazio */ }

  if (!resp.ok || !json.id) {
    console.warn('[pagarme recipient] erro', resp.status, raw.slice(0, 1500))
    // Pagar.me retorna errors em formatos variados:
    //   1) { errors: { campo: ["msg"] } }
    //   2) { errors: [{ field: "...", message: "..." }] }
    //   3) só message
    // Achatamos pra um formato amigável { campo: "msg" } sempre.
    const camposErro: Record<string, string> = {}
    const errs = json.errors
    if (errs && typeof errs === 'object') {
      if (Array.isArray(errs)) {
        for (const e of errs) {
          if (e && typeof e === 'object') {
            const ee = e as { field?: string; message?: string }
            if (ee.field) camposErro[ee.field] = ee.message || 'inválido'
          }
        }
      } else {
        for (const [campo, val] of Object.entries(errs as Record<string, unknown>)) {
          const msg = Array.isArray(val) ? val.join('; ') : String(val)
          camposErro[campo] = msg
        }
      }
    }
    const mensagem = (json.message as string)
      || (Object.keys(camposErro).length > 0
        ? 'Pagar.me reclamou destes campos: ' + Object.entries(camposErro).slice(0, 4).map(([k, v]) => `${k} (${v})`).join('; ')
        : 'Pagar.me recusou o cadastro. Tente de novo.')
    return { ok: false, erro: mensagem, detalhes: { errors: errs, raw: raw.slice(0, 500) }, status: resp.status || 502 }
  }

  return {
    ok: true,
    recipientId: json.id,
    status: normalizarStatus(json.status),
  }
}
