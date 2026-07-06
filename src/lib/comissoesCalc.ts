// Metadata visual de status de comissão + cálculo de totais financeiros.
// Modelo HÍBRIDO: saldo_disponivel (legacy + comissões creditadas pelo
// trigger) é a fonte única para saque; comissões dão a visão detalhada.

export type ComissaoStatus =
  | 'pendente'      // órfão: pedido pago mas sem revendedora associada
  | 'processando'   // 20 dias de carência anti-fraude (em saldo_processando)
  | 'liberada'      // já no saldo_disponivel, pronto p/ saque
  | 'paga'          // saque pago
  | 'cancelada'

export type ComissaoStatusMeta = { label: string; bg: string; color: string }

// Paleta no tema da revendedora (rosa/teal).
export const COMISSAO_STATUS_META: Record<string, ComissaoStatusMeta> = {
  pendente: { label: 'A liberar', bg: 'var(--rosa-mist)', color: 'var(--rosa)' },
  processando: { label: 'Em análise', bg: '#FEF3C7', color: '#92400E' },
  liberada: { label: 'Liberada', bg: 'var(--teal-pale)', color: 'var(--teal-dark)' },
  paga: { label: 'Paga', bg: '#E1F5EE', color: '#089C82' },
  cancelada: { label: 'Cancelada', bg: '#FCEBEB', color: '#A32D2D' },
}

// "libera em 12 dias" / "libera hoje" — countdown p/ comissões em
// 'processando'. Retorna null se já passou ou não tem data.
export function diasParaLiberar(dataLiberacao: string | null | undefined): number | null {
  if (!dataLiberacao) return null
  const ms = new Date(dataLiberacao).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

export function comissaoStatusMeta(status: string): ComissaoStatusMeta {
  return (
    COMISSAO_STATUS_META[status] || {
      label: status,
      bg: 'var(--cinza-light)',
      color: 'var(--cinza)',
    }
  )
}

export type ComissaoRow = {
  valor_comissao: number | string
  status: string
}

export type SaqueRow = {
  valor: number | string
  status: string
}

export type Totais = {
  // Saldo único que habilita o saque (legacy + comissões creditadas).
  disponivel: number
  saldoProcessando: number
  // Comissões ainda não liberadas (informativo).
  aLiberar: number
  // Tudo que já foi liberado/pago via comissões (informativo).
  totalGanhoComissoes: number
  totalSacado: number
  emSaque: number
}

export function calcularTotais(
  saldoDisponivel: number,
  saldoProcessando: number,
  comissoes: ComissaoRow[],
  saques: SaqueRow[]
): Totais {
  const soma = (arr: { valor_comissao?: number | string; valor?: number | string }[], key: 'valor_comissao' | 'valor') =>
    arr.reduce((acc, x) => acc + Number(x[key] || 0), 0)

  const liberadas = comissoes.filter(
    c => c.status === 'liberada' || c.status === 'paga'
  )
  // "A liberar" inclui órfãos (pendente) E os em carência de 20d
  // (processando). Ambos ainda não estão em saldo_disponivel.
  const pendentes = comissoes.filter(c => c.status === 'pendente' || c.status === 'processando')

  const totalSacado = soma(
    saques.filter(s => s.status === 'pago'),
    'valor'
  )
  const emSaque = soma(
    saques.filter(s => s.status === 'solicitado' || s.status === 'processando'),
    'valor'
  )

  return {
    disponivel: Number(saldoDisponivel || 0),
    saldoProcessando: Number(saldoProcessando || 0),
    aLiberar: soma(pendentes, 'valor_comissao'),
    totalGanhoComissoes: soma(liberadas, 'valor_comissao'),
    totalSacado,
    emSaque,
  }
}
