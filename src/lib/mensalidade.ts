// Mensalidade da loja: valor + cálculo de situação. Server e client.

export const MENSALIDADE_VALOR = Number(
  process.env.NEXT_PUBLIC_MENSALIDADE || '39.90'
)
export const AVISO_DIAS = 5 // avisa 5 dias antes
export const CICLO_DIAS = 30 // cada pagamento estende 30 dias

export type SituacaoMensalidade =
  | 'isento'
  | 'sem_data'
  | 'em_dia'
  | 'a_vencer'
  | 'vence_hoje'
  | 'vencida'

export function diasAteVencer(venceEm: string | null): number | null {
  if (!venceEm) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const v = new Date(`${venceEm}T00:00:00`)
  return Math.round((v.getTime() - hoje.getTime()) / 86400000)
}

export function situacaoMensalidade(
  venceEm: string | null,
  isento: boolean
): { situacao: SituacaoMensalidade; dias: number | null } {
  if (isento) return { situacao: 'isento', dias: null }
  const dias = diasAteVencer(venceEm)
  if (dias === null) return { situacao: 'sem_data', dias: null }
  if (dias < 0) return { situacao: 'vencida', dias }
  if (dias === 0) return { situacao: 'vence_hoje', dias }
  if (dias <= AVISO_DIAS) return { situacao: 'a_vencer', dias }
  return { situacao: 'em_dia', dias }
}

export const SITUACAO_META: Record<
  SituacaoMensalidade,
  { label: string; bg: string; text: string }
> = {
  isento: { label: 'Isento', bg: '#F5F5F5', text: '#64748B' },
  sem_data: { label: 'Sem data', bg: '#F5F5F5', text: '#64748B' },
  em_dia: { label: 'Em dia', bg: '#D1FAE5', text: '#065F46' },
  a_vencer: { label: 'A vencer', bg: '#FEF3C7', text: '#92400E' },
  vence_hoje: { label: 'Vence hoje', bg: '#FFEDD5', text: '#9A3412' },
  vencida: { label: 'Vencida', bg: '#FEE2E2', text: '#991B1B' },
}

// Soma `dias` a partir do maior entre hoje e o vencimento atual (YYYY-MM-DD).
export function novoVencimento(venceAtual: string | null): string {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let base = hoje
  if (venceAtual) {
    const v = new Date(`${venceAtual}T00:00:00`)
    if (v.getTime() > hoje.getTime()) base = v
  }
  const novo = new Date(base.getTime() + CICLO_DIAS * 86400000)
  return novo.toISOString().slice(0, 10)
}
