// Estado de pedidos. Operação MANUAL: o admin pode mover um pedido para
// qualquer status (livre), inclusive corrigir/reverter. A comissão é
// gerada/reativada sempre que o pedido entra em 'pago' (trigger no banco).
// Importable desde server (APIs) y client (página admin).

export type PedidoStatus =
  | 'aguardando_pagamento'
  | 'pago'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

// Horas para considerar un pedido "abandonado" (aguardando_pagamento + viejo)
export const ABANDONO_HORAS = 48

// Todos os status reais, na ordem natural do fluxo (p/ botões do admin).
export const STATUS_FLUXO: PedidoStatus[] = [
  'aguardando_pagamento',
  'pago',
  'enviado',
  'entregue',
  'cancelado',
]

// Transição livre: qualquer status conhecido → qualquer outro (≠ atual).
export function transicaoValida(de: string, para: string): boolean {
  return (
    de !== para &&
    STATUS_FLUXO.includes(para as PedidoStatus) &&
    STATUS_FLUXO.includes(de as PedidoStatus)
  )
}

export type StatusMeta = { label: string; bg: string; text: string }

export const STATUS_META: Record<string, StatusMeta> = {
  aguardando_pagamento: { label: 'Aguardando', bg: '#FEF3C7', text: '#92400E' },
  pago: { label: 'Pago', bg: '#DBEAFE', text: '#1E40AF' },
  enviado: { label: 'Enviado', bg: '#EDE9FE', text: '#5B21B6' },
  entregue: { label: 'Entregue', bg: '#D1FAE5', text: '#065F46' },
  cancelado: { label: 'Cancelado', bg: '#FEE2E2', text: '#991B1B' },
  abandonado: { label: 'Abandonado', bg: '#FED7AA', text: '#9A3412' },
}

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] || { label: status, bg: '#F5F5F5', text: '#64748B' }
}

// ¿El pedido cuenta como abandonado? (solo visual / filtro frontend)
export function isAbandonado(status: string, createdAt: string): boolean {
  if (status !== 'aguardando_pagamento') return false
  const idadeMs = Date.now() - new Date(createdAt).getTime()
  return idadeMs > ABANDONO_HORAS * 3600 * 1000
}
