// Lembra a última loja (subdomínio da revendedora) que o COMPRADOR visitou.
// Usado pelos links "voltar / continuar comprando" pra nunca jogar o cliente
// na landing de captação de revendedoras (que é a raiz `/`). SSR-safe.
const KEY = 'prata15:ultimaLoja'

export function setUltimaLoja(slug: string): void {
  if (typeof window === 'undefined' || !slug) return
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    /* localStorage indisponível — ignora */
  }
}

export function getUltimaLoja(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}
