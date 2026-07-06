// Helper client-side: obtém o token da sessão Supabase e chama a API
// /api/revendedora/financeiro com Authorization: Bearer.

import { createClient } from '@/lib/supabase'

export type ComissaoView = {
  id: string
  numero_pedido: string | null
  cliente_nome: string | null
  valor_base: number
  percentual: number
  valor_comissao: number
  status: string
  data_liberacao: string | null
  created_at: string
}

export type PedidoAguardando = {
  id: string
  numero_pedido: string | null
  cliente_nome: string | null
  cliente_telefone: string | null
  total: number
  created_at: string
}

export type FinanceiroData = {
  revendedora: {
    nome: string
    nome_loja: string | null
    subdominio: string
    status: string
    pagarme_recipient_id: string | null
    pagarme_recipient_status: string | null
  }
  totais: {
    disponivel: number
    saldoProcessando: number
    aLiberar: number
    totalGanhoComissoes: number
    totalSacado: number
    emSaque: number
  }
  comissoes: ComissaoView[]
  pedidosAguardando: PedidoAguardando[]
}

export type FinanceiroResult =
  | { status: 'ok'; data: FinanceiroData }
  | { status: 'unauth' }
  | { status: 'erro' }

export async function getFinanceiro(): Promise<FinanceiroResult> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { status: 'unauth' }
  try {
    const res = await fetch('/api/revendedora/financeiro', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (res.status === 401) return { status: 'unauth' }
    if (!res.ok) return { status: 'erro' }
    return { status: 'ok', data: (await res.json()) as FinanceiroData }
  } catch {
    return { status: 'erro' }
  }
}

export async function getVisitas(): Promise<{ hoje: number; ultimos_7d: number }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { hoje: 0, ultimos_7d: 0 }
  try {
    const res = await fetch('/api/revendedora/visitas', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { hoje: 0, ultimos_7d: 0 }
    return (await res.json()) as { hoje: number; ultimos_7d: number }
  } catch {
    return { hoje: 0, ultimos_7d: 0 }
  }
}

export type PedidoItemView = {
  id?: string
  sku?: string
  nome: string
  preco: number
  quantidade: number
  foto?: string
  variacao?: string
  ref?: string
}

export type PedidoView = {
  id: string
  numero_pedido: string | null
  status: string
  created_at: string
  cliente: { nome: string; email: string; telefone: string; cpf: string }
  endereco: {
    cep: string; rua: string; numero: string; complemento: string | null
    bairro: string; cidade: string; uf: string
  }
  itens: PedidoItemView[]
  subtotal: number
  frete: number
  total: number
  regiao_frete: string | null
  observacoes: string | null
  codigo_rastreio: string | null
  comissao: { valor: number; percentual: number; status: string } | null
}

export type PedidosResult =
  | { status: 'ok'; pedidos: PedidoView[] }
  | { status: 'unauth' }
  | { status: 'erro' }

export async function getPedidos(): Promise<PedidosResult> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { status: 'unauth' }
  try {
    const res = await fetch('/api/revendedora/pedidos', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (res.status === 401) return { status: 'unauth' }
    if (!res.ok) return { status: 'erro' }
    const data = (await res.json()) as { pedidos: PedidoView[] }
    return { status: 'ok', pedidos: data.pedidos || [] }
  } catch {
    return { status: 'erro' }
  }
}
