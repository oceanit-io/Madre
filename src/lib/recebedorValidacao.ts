// Validações brasileiras + máscaras de input pro cadastro de recebedor
// no Pagar.me. Cobre: CPF, CNPJ, CEP, telefone, banco (3 dígitos),
// agência e conta com dígitos.

// ============================================================
// CPF
// ============================================================
export function validarCPF(raw: string): boolean {
  const cpf = (raw || '').replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf[9], 10)) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === parseInt(cpf[10], 10)
}

export function maskCPF(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

// ============================================================
// CNPJ
// ============================================================
export function validarCNPJ(raw: string): boolean {
  const cnpj = (raw || '').replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (peso: number[]) => {
    let s = 0
    for (let i = 0; i < peso.length; i++) s += parseInt(cnpj[i], 10) * peso[i]
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  const peso1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const peso2 = [6, ...peso1]
  return calc(peso1) === parseInt(cnpj[12], 10) && calc(peso2) === parseInt(cnpj[13], 10)
}

export function maskCNPJ(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 14)
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`
  return d
}

// Aceita CPF (11) OU CNPJ (14) consoante o tamanho.
export function validarDocumento(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 11) return validarCPF(d)
  if (d.length === 14) return validarCNPJ(d)
  return false
}

export function maskDocumento(v: string): string {
  const d = (v || '').replace(/\D/g, '')
  return d.length > 11 ? maskCNPJ(d) : maskCPF(d)
}

// ============================================================
// CEP
// ============================================================
export function validarCEP(raw: string): boolean {
  return (raw || '').replace(/\D/g, '').length === 8
}

export function maskCEP(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8)
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`
  return d
}

// ============================================================
// Telefone — DDD + número, móvel (11 dígitos) ou fixo (10).
// ============================================================
export type TipoTelefone = 'mobile' | 'home' | 'work'

export function validarDDD(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 2) return false
  const n = parseInt(d, 10)
  // DDDs válidos no Brasil: 11-99, excluindo alguns gaps. Lista resumida.
  return n >= 11 && n <= 99
}

export function validarTelefone(numero: string): boolean {
  const d = (numero || '').replace(/\D/g, '')
  return d.length === 8 || d.length === 9
}

export function maskTelefoneNumero(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 9)
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`
  if (d.length > 4) return `${d.slice(0, 4)}-${d.slice(4)}`
  return d
}

// ============================================================
// Dados bancários
// ============================================================
export function validarCodigoBanco(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  return d.length === 3
}

export function validarAgencia(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  return d.length >= 1 && d.length <= 6
}

export function validarConta(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  return d.length >= 1 && d.length <= 13
}

// ============================================================
// Data de nascimento (DD/MM/AAAA)
// ============================================================
export function maskData(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8)
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`
  return d
}

export function validarData(raw: string): boolean {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 8) return false
  const dia = parseInt(d.slice(0, 2), 10)
  const mes = parseInt(d.slice(2, 4), 10)
  const ano = parseInt(d.slice(4), 10)
  if (mes < 1 || mes > 12) return false
  if (dia < 1 || dia > 31) return false
  // Maior de 18, menor de 110
  const hoje = new Date()
  const idade = hoje.getFullYear() - ano
  return idade >= 18 && idade <= 110
}

// Converte DD/MM/AAAA → AAAA-MM-DD (formato Pagar.me API).
export function dataParaISO(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 8) return null
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

// ============================================================
// Faturamento mensal — faixas pre-definidas pra simplificar pro user.
// ============================================================
export const FAIXAS_FATURAMENTO = [
  { id: 'ate_1k',       label: 'Até R$ 1.000',           valor: 1000 },
  { id: '1k_5k',        label: 'R$ 1.001 a R$ 5.000',    valor: 5000 },
  { id: '5k_15k',       label: 'R$ 5.001 a R$ 15.000',   valor: 15000 },
  { id: '15k_50k',      label: 'R$ 15.001 a R$ 50.000',  valor: 50000 },
  { id: '50k_100k',     label: 'R$ 50.001 a R$ 100.000', valor: 100000 },
  { id: 'acima_100k',   label: 'Acima de R$ 100.000',    valor: 200000 },
]

export function faturamentoValido(id: string | null | undefined): boolean {
  return FAIXAS_FATURAMENTO.some(f => f.id === id)
}

export function faturamentoValor(id: string | null | undefined): number {
  const f = FAIXAS_FATURAMENTO.find(x => x.id === id)
  return f?.valor || 1000
}

// ============================================================
// Tipo de conta bancária — Pagar.me API valores oficiais.
// ============================================================
export const TIPOS_CONTA = [
  { id: 'checking',       label: 'Conta corrente' },
  { id: 'savings',        label: 'Conta poupança' },
  { id: 'checking_joint', label: 'Conta corrente conjunta' },
  { id: 'savings_joint',  label: 'Conta poupança conjunta' },
] as const

export type TipoConta = typeof TIPOS_CONTA[number]['id']

export function tipoContaValido(id: string | null | undefined): boolean {
  return TIPOS_CONTA.some(t => t.id === id)
}
