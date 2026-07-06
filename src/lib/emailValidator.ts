// Validador de e-mail que detecta typos comuns ANTES de mandar pro Supabase.
//
// Caso real: Edna se cadastrou com "@gmail.comom" — Supabase aceitou
// (regex padrão admite "comom" como TLD) mas ela nunca recebeu email
// e ficou perdida. Esse validador bloqueia typos comuns e sugere correção.
//
// Uso:
//   const err = validarEmail('foo@gmail.comom')
//   if (err) setErro(err)  // "Você quis dizer foo@gmail.com?"

// TLDs válidos comuns no Brasil — se TLD não tá aqui, bloqueia.
// Não é lista completa do mundo, mas cobre 99% do tráfego pra Brasil.
const TLDS_VALIDOS = new Set([
  // Brasileiros
  'br', 'com.br', 'org.br', 'net.br', 'edu.br', 'gov.br',
  // Genéricos
  'com', 'org', 'net', 'edu', 'gov', 'mil',
  'info', 'biz', 'co', 'me', 'io', 'app', 'dev',
  'store', 'shop', 'online', 'site', 'blog',
  'tv', 'ai', 'cloud', 'live', 'design', 'tech',
  // Outros países comuns
  'us', 'uk', 'ca', 'fr', 'de', 'es', 'pt', 'it',
  'mx', 'ar', 'cl', 'pe', 'co', 'uy',
])

// Typos comuns de TLDs → sugestão correta
const TYPOS_TLD: Record<string, string> = {
  'comom': 'com',
  'comm': 'com',
  'ccom': 'com',
  'coom': 'com',
  'cm': 'com',
  'cmo': 'com',
  'con': 'com',
  'om': 'com',
  'cop': 'com',
  'coml': 'com',
  'come': 'com',
  'como': 'com',
  'comr': 'com.br',
  'com.b': 'com.br',
  'combr': 'com.br',
  'orgg': 'org',
  'nte': 'net',
}

// Typos comuns de provedores → sugestão correta
const TYPOS_DOMINIO: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotamail.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'yhaoo.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'icloud.co': 'icloud.com',
  'iclud.com': 'icloud.com',
  'live.con': 'live.com',
}

/**
 * Valida o email retornando null se válido, ou string com mensagem
 * de erro amigável (incluindo sugestão de correção quando aplicável).
 */
export function validarEmail(email: string): string | null {
  const e = (email || '').trim().toLowerCase()
  if (!e) return 'Informe o e-mail.'
  if (!e.includes('@')) return 'E-mail inválido. Falta o @.'

  // Regex básica primeiro
  const regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/
  if (!regex.test(e)) return 'E-mail inválido. Confira a digitação.'

  const [local, dominio] = e.split('@')
  if (!local || !dominio) return 'E-mail inválido.'
  if (!dominio.includes('.')) return 'E-mail inválido. Domínio sem ponto.'

  // Typo no domínio inteiro? (ex: gmial.com → gmail.com)
  if (TYPOS_DOMINIO[dominio]) {
    return `Você quis dizer ${local}@${TYPOS_DOMINIO[dominio]}? Corrige por favor.`
  }

  // Extrai TLD (parte após o último ponto, ou os 2 últimos se .com.br)
  const partes = dominio.split('.')
  if (partes.length < 2) return 'E-mail inválido. Domínio sem extensão.'

  const ultimo = partes[partes.length - 1]
  const penultimo = partes.length >= 2 ? partes[partes.length - 2] : ''
  const tld2partes = penultimo ? `${penultimo}.${ultimo}` : ''

  // Typo no TLD? (ex: .comom → .com)
  if (TYPOS_TLD[ultimo]) {
    const corrigido = dominio.slice(0, dominio.length - ultimo.length) + TYPOS_TLD[ultimo]
    return `Você quis dizer ${local}@${corrigido}? O ".${ultimo}" parece estar errado.`
  }

  // TLD válido? Checa primeiro o de 2 partes (com.br), senão o de 1 (.com)
  const tldValido = TLDS_VALIDOS.has(tld2partes) || TLDS_VALIDOS.has(ultimo)
  if (!tldValido) {
    return `O final ".${ultimo}" não parece um e-mail válido. Confira.`
  }

  return null
}
