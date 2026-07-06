// Integração com a Plataforma Pronta de Negócios (PPN) dos Correios.
//
// Documentação: https://www.correios.com.br/atendimento/developers/manual-do-usuario-ppn
//
// Fluxo:
//   1. Autenticação via cartão de postagem (Basic Auth com usuário/senha) →
//      retorna JWT válido ~24h. Cacheado em memória do servidor.
//   2. Para cada serviço (PAC, SEDEX) chama preço + prazo em paralelo.
//   3. Sem env vars ou em caso de erro retorna null → caller cai pra tabela
//      fixa em [[lib-frete]].
//
// Env vars necessárias (todas obrigatórias para ativar):
//   - CORREIOS_USUARIO          (usuário API dos Correios)
//   - CORREIOS_SENHA            (senha API dos Correios)
//   - CORREIOS_CONTRATO         (número do contrato, ex "9912345678")
//   - CORREIOS_CARTAO_POSTAGEM  (número do cartão de postagem)
//   - CORREIOS_DR               (código da DR/região do contrato, ex "10")
//   - CORREIOS_CEP_ORIGEM       (CEP de onde sai o envio, só dígitos)
//   - CORREIOS_PAC_CODIGO       (código do serviço PAC contratado, ex "03298")
//   - CORREIOS_SEDEX_CODIGO     (código do serviço SEDEX contratado, ex "03220")

const BASE_URL = 'https://api.correios.com.br'

export type ServicoCorreios = 'PAC' | 'SEDEX'

export type FreteCorreios = {
  servico: ServicoCorreios
  valor: number
  prazo_dias: number
}

type CredCorreios = {
  usuario: string
  senha: string
  contrato: string
  cartao: string
  dr: string
  cepOrigem: string
  pacCodigo: string
  sedexCodigo: string
}

// Diagnóstico estruturado: retorna lista das env vars faltantes ou
// inválidas. Útil pra exposição num endpoint /api/admin/correios-diag
// (resumido) e logs server-side detalhados.
export function diagnosticoCorreios(): { ok: true; cred: CredCorreios } | { ok: false; faltantes: string[] } {
  const faltantes: string[] = []
  const usuario = process.env.CORREIOS_USUARIO
  const senha = process.env.CORREIOS_SENHA
  const contrato = process.env.CORREIOS_CONTRATO
  const cartao = process.env.CORREIOS_CARTAO_POSTAGEM
  const dr = process.env.CORREIOS_DR
  const cepOrigemRaw = process.env.CORREIOS_CEP_ORIGEM || ''
  const cepOrigem = cepOrigemRaw.replace(/\D/g, '')
  const pacCodigo = process.env.CORREIOS_PAC_CODIGO
  const sedexCodigo = process.env.CORREIOS_SEDEX_CODIGO

  if (!usuario)    faltantes.push('CORREIOS_USUARIO')
  if (!senha)      faltantes.push('CORREIOS_SENHA')
  if (!contrato)   faltantes.push('CORREIOS_CONTRATO')
  if (!cartao)     faltantes.push('CORREIOS_CARTAO_POSTAGEM')
  if (!dr)         faltantes.push('CORREIOS_DR')
  if (cepOrigem.length !== 8) faltantes.push(`CORREIOS_CEP_ORIGEM (valor "${cepOrigemRaw}" tem ${cepOrigem.length} dígitos, deveria ter 8)`)
  if (!pacCodigo)  faltantes.push('CORREIOS_PAC_CODIGO')
  if (!sedexCodigo) faltantes.push('CORREIOS_SEDEX_CODIGO')

  if (faltantes.length > 0) return { ok: false, faltantes }
  return { ok: true, cred: { usuario: usuario!, senha: senha!, contrato: contrato!, cartao: cartao!, dr: dr!, cepOrigem, pacCodigo: pacCodigo!, sedexCodigo: sedexCodigo! } }
}

function lerCreds(): CredCorreios | null {
  const diag = diagnosticoCorreios()
  if (diag.ok === false) {
    console.warn('[correios] env vars faltantes/inválidas:', diag.faltantes.join(', '))
    return null
  }
  return diag.cred
}

// Cache do JWT em memória do processo. Token Correios vale ~24h; renovamos
// com margem de 1h. Em ambiente serverless cada cold start vai re-autenticar,
// o que é aceitável (1 chamada extra a cada novo container).
let tokenCache: { token: string; expiraEm: number } | null = null

async function obterToken(cred: CredCorreios): Promise<string | null> {
  const agora = Date.now()
  if (tokenCache && tokenCache.expiraEm > agora + 60 * 60 * 1000) {
    return tokenCache.token
  }
  const basic = Buffer.from(`${cred.usuario}:${cred.senha}`).toString('base64')
  let resp: Response
  try {
    resp = await fetch(`${BASE_URL}/token/v1/autentica/cartaopostagem`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ numero: cred.cartao }),
      cache: 'no-store',
    })
  } catch (e) {
    console.warn('[correios] auth network error', e)
    return null
  }
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '')
    console.warn('[correios] auth FAILED', resp.status, 'cartao=' + cred.cartao.slice(0, 4) + '...', corpo.slice(0, 400))
    return null
  }
  const data = (await resp.json().catch(() => null)) as { token?: string; expiraEm?: string } | null
  if (!data?.token) {
    console.warn('[correios] auth missing token in response')
    return null
  }
  // expiraEm vem ISO string. Se faltar, assume 23h.
  const expira = data.expiraEm ? Date.parse(data.expiraEm) : agora + 23 * 60 * 60 * 1000
  tokenCache = { token: data.token, expiraEm: Number.isFinite(expira) ? expira : agora + 23 * 60 * 60 * 1000 }
  return data.token
}

type ConsultaInput = {
  cepDestino: string  // só dígitos
  pesoG: number       // gramas
  comprimentoCm: number
  larguraCm: number
  alturaCm: number
}

async function consultaPrecoPrazo(
  token: string,
  cred: CredCorreios,
  codigoServico: string,
  input: ConsultaInput,
): Promise<{ valor: number; prazo: number } | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  // Os endpoints individuais (/preco/v1/nacional/{coProduto}) usam GET
  // com query params — POST é só pro endpoint bulk sem {coProduto}.
  const qsPreco = new URLSearchParams({
    nuRequisicao: '1',
    nuContrato: cred.contrato,
    nuDR: cred.dr,
    cepOrigem: cred.cepOrigem,
    cepDestino: input.cepDestino,
    psObjeto: String(Math.max(1, Math.round(input.pesoG))),
    comprimento: String(input.comprimentoCm),
    largura: String(input.larguraCm),
    altura: String(input.alturaCm),
    tpObjeto: '2', // 2 = caixa/pacote
  }).toString()
  const qsPrazo = new URLSearchParams({
    nuRequisicao: '1',
    cepOrigem: cred.cepOrigem,
    cepDestino: input.cepDestino,
  }).toString()
  let respPreco: Response, respPrazo: Response
  try {
    ;[respPreco, respPrazo] = await Promise.all([
      fetch(`${BASE_URL}/preco/v1/nacional/${codigoServico}?${qsPreco}`, {
        method: 'GET', headers, cache: 'no-store',
      }),
      fetch(`${BASE_URL}/prazo/v1/nacional/${codigoServico}?${qsPrazo}`, {
        method: 'GET', headers, cache: 'no-store',
      }),
    ])
  } catch (e) {
    console.warn('[correios] preco/prazo network error', codigoServico, e)
    return null
  }
  if (!respPreco.ok || !respPrazo.ok) {
    const corpoPrecoErr = !respPreco.ok ? await respPreco.text().catch(() => '') : ''
    const corpoPrazoErr = !respPrazo.ok ? await respPrazo.text().catch(() => '') : ''
    console.warn('[correios] preco/prazo FAILED servico=' + codigoServico,
      'preco=' + respPreco.status, 'prazo=' + respPrazo.status,
      corpoPrecoErr.slice(0, 300), corpoPrazoErr.slice(0, 300))
    return null
  }
  const preco = (await respPreco.json().catch(() => null)) as { pcFinal?: string; pcBase?: string } | null
  const prazo = (await respPrazo.json().catch(() => null)) as { prazoEntrega?: number | string } | null
  // pcFinal vem como string "12,50". Converte pra number.
  const valorStr = preco?.pcFinal ?? preco?.pcBase
  if (!valorStr) return null
  const valor = Number(String(valorStr).replace(',', '.'))
  const prazoDias = Number(prazo?.prazoEntrega ?? 0)
  if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(prazoDias) || prazoDias <= 0) return null
  return { valor, prazo: prazoDias }
}

// Calcula PAC + SEDEX em paralelo. Retorna array com os serviços que
// responderam OK. Se nenhum responder, retorna null → fallback.
export async function calcularFretesCorreios(input: ConsultaInput): Promise<FreteCorreios[] | null> {
  const cred = lerCreds()
  if (!cred) return null
  if (input.cepDestino.length !== 8) return null

  const token = await obterToken(cred)
  if (!token) return null

  const [pac, sedex] = await Promise.all([
    consultaPrecoPrazo(token, cred, cred.pacCodigo, input),
    consultaPrecoPrazo(token, cred, cred.sedexCodigo, input),
  ])

  const resultado: FreteCorreios[] = []
  if (pac) resultado.push({ servico: 'PAC', valor: pac.valor, prazo_dias: pac.prazo })
  if (sedex) resultado.push({ servico: 'SEDEX', valor: sedex.valor, prazo_dias: sedex.prazo })

  if (resultado.length === 0) return null
  return resultado
}

// Parâmetros padrão pra envio de joia. O contrato é "por pacote" (preço
// fixo por encomenda dentro do limite do pacote contratado, ex. 1 kg).
// Usamos peso fixo seguro de 500 g — cabe sempre num pacote 1 kg, mesmo
// que o cliente leve várias peças. Caixinha pequena padrão.
export const PESO_FIXO_GRAMAS = 500
export const CAIXA_PADRAO = { comprimentoCm: 16, larguraCm: 11, alturaCm: 4 }

// ─────────────────────────────────────────────────────────────────────
//  RASTREAMENTO (SRO) — eventos reais do objeto nos Correios.
//  Mesma auth (token do cartão de postagem). Best-effort: nunca lança;
//  retorna null em falha (a UI cai no link público dos Correios).
// ─────────────────────────────────────────────────────────────────────

export type EventoRastreio = {
  data: string          // dtHrCriado (ISO) ou ''
  status: string        // descrição do evento (ex.: "Objeto postado")
  local: string | null  // cidade/UF da unidade, quando houver
}

/** Link público dos Correios pra um código de rastreio. */
export function linkRastreamentoCorreios(codigo: string): string {
  return `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent((codigo || '').trim())}`
}

/**
 * Consulta os eventos de um objeto na API SRO dos Correios.
 * Retorna:
 *   - array de eventos (mais recente primeiro) se OK,
 *   - [] se o objeto ainda não tem eventos / não encontrado,
 *   - null se a integração falhou (sem credenciais, rede, etc.).
 */
export async function rastrearObjeto(codigo: string): Promise<EventoRastreio[] | null> {
  const limpo = (codigo || '').trim().toUpperCase()
  if (!limpo) return null
  const cred = lerCreds()
  if (!cred) return null
  const token = await obterToken(cred)
  if (!token) return null

  let resp: Response
  try {
    resp = await fetch(`${BASE_URL}/srorastro/v1/objetos/${encodeURIComponent(limpo)}?resultado=T`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (e) {
    console.warn('[correios] rastreio network error', e)
    return null
  }
  if (!resp.ok) {
    console.warn('[correios] rastreio FAILED', resp.status)
    return null
  }
  type SroResp = {
    objetos?: Array<{
      mensagem?: string
      eventos?: Array<{
        dtHrCriado?: string
        descricao?: string
        unidade?: { tipo?: string; endereco?: { cidade?: string; uf?: string } }
      }>
    }>
  }
  const data = (await resp.json().catch(() => null)) as SroResp | null
  const obj = data?.objetos?.[0]
  if (!obj) return null
  if (obj.mensagem || !obj.eventos) return [] // sem eventos ainda (recém-postado/não achado)

  return obj.eventos.map(e => {
    const end = e.unidade?.endereco
    const local = end && (end.cidade || end.uf)
      ? `${end.cidade || ''}${end.cidade && end.uf ? '/' : ''}${end.uf || ''}`
      : (e.unidade?.tipo || null)
    return {
      data: e.dtHrCriado || '',
      status: e.descricao || '',
      local,
    }
  })
}
