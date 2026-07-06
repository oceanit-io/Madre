// Lista dos bancos brasileiros mais comuns para o select de cadastro
// bancário. Código FEBRABAN (3 dígitos) — formato exigido pela API
// Pagar.me em default_bank_account.bank.
//
// Lista enxuta cobrindo >95% dos clientes BR. Se faltar algum, a
// revendedora pode digitar o código de 3 dígitos manualmente.

export type Banco = { codigo: string; nome: string; nomeCurto?: string }

export const BANCOS_BR: Banco[] = [
  // Top tradicionais
  { codigo: '001', nome: 'Banco do Brasil',                 nomeCurto: 'BB' },
  { codigo: '104', nome: 'Caixa Econômica Federal',         nomeCurto: 'Caixa' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú Unibanco',                   nomeCurto: 'Itaú' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '422', nome: 'Banco Safra' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '004', nome: 'Banco do Nordeste' },
  { codigo: '021', nome: 'Banestes' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },

  // Digitais (muito comuns hoje)
  { codigo: '260', nome: 'Nubank' },
  { codigo: '290', nome: 'PagBank',                          nomeCurto: 'PagSeguro' },
  { codigo: '380', nome: 'PicPay' },
  { codigo: '077', nome: 'Inter',                            nomeCurto: 'Banco Inter' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '655', nome: 'Banco Votorantim',                 nomeCurto: 'Neon' },
  { codigo: '197', nome: 'Stone',                            nomeCurto: 'Stone Pagamentos' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '364', nome: 'Gerencianet (Efí)' },
  { codigo: '403', nome: 'Cora' },
  { codigo: '332', nome: 'Acesso Soluções de Pagamento' },
  { codigo: '085', nome: 'Cooperativa Central de Crédito Ailos' },
  { codigo: '102', nome: 'XP Investimentos' },
  { codigo: '348', nome: 'Banco XP' },
  { codigo: '218', nome: 'BS2' },
  { codigo: '457', nome: 'UY3 (Pinbank)' },

  // Cooperativas e regionais frequentes
  { codigo: '136', nome: 'Unicred' },
  { codigo: '383', nome: 'Juno' },
  { codigo: '335', nome: 'Banco Digio' },
  { codigo: '633', nome: 'Banco Rendimento' },
  { codigo: '637', nome: 'Banco Sofisa' },
  { codigo: '422', nome: 'Banco Safra' },
  { codigo: '070', nome: 'BRB - Banco de Brasília' },
]

// Busca por código (3 dígitos) ou nome (substring case-insensitive).
export function buscarBancos(query: string, max = 12): Banco[] {
  const q = query.trim().toLowerCase()
  if (!q) return BANCOS_BR.slice(0, max)
  const numerico = q.replace(/\D/g, '')
  return BANCOS_BR
    .filter(b => {
      if (numerico && b.codigo.startsWith(numerico)) return true
      if (b.nome.toLowerCase().includes(q)) return true
      if (b.nomeCurto?.toLowerCase().includes(q)) return true
      return false
    })
    .slice(0, max)
}

export function bancoPorCodigo(codigo: string): Banco | null {
  const c = (codigo || '').padStart(3, '0').slice(-3)
  return BANCOS_BR.find(b => b.codigo === c) || null
}
