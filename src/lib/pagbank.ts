// Integração PagBank — INATIVA até configurar as envs.
//
// Enquanto NÃO existir `PAGBANK_TOKEN`, tudo aqui é no-op: nenhuma
// chamada externa, nenhum link gerado, e o fluxo manual atual (WhatsApp /
// admin marca "pago" / link pag.ae) segue 100% igual. Zero risco.
//
// Quando a API estiver liberada, basta setar no Vercel:
//   PAGBANK_TOKEN     -> token da API PagBank (obrigatório p/ ativar)
//   PAGBANK_BASE_URL  -> opcional. Sandbox: https://sandbox.api.pagseguro.com
//                        Produção (default): https://api.pagbank.com
//   APP_URL           -> base pública (p/ a notification_url do webhook),
//                        ex: https://lojadeprata925.com.br
//
// E registrar no painel PagBank o webhook:  {APP_URL}/api/webhook/pagbank

// Apesar do rebrand PagSeguro → PagBank, a API ainda usa o domínio
// antigo `api.pagseguro.com`. `api.pagbank.com` não resolve.
const BASE = process.env.PAGBANK_BASE_URL || 'https://api.pagseguro.com'

export function pagbankHabilitado(): boolean {
  return !!process.env.PAGBANK_TOKEN
}

export type DadosCobranca = {
  numeroPedido: string
  total: number // em reais
  cliente: { nome: string; email: string; telefone: string; cpf: string }
}

// Cria um link de pagamento PagBank. Retorna null se desativado/erro
// (NUNCA lança — o pedido não pode quebrar por causa disto).
export async function criarLinkPagBank(
  d: DadosCobranca
): Promise<{ link: string } | null> {
  if (!pagbankHabilitado()) return null

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lojadeprata925.com.br'

  const telefone = (d.cliente.telefone || '').replace(/\D/g, '')
  const ddd = telefone.slice(0, 2) || '11'
  const numero = telefone.slice(2) || '999999999'
  const totalCent = Math.round(Number(d.total || 0) * 100)

  try {
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAGBANK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_id: d.numeroPedido,
        customer: {
          name: d.cliente.nome,
          email: d.cliente.email,
          tax_id: (d.cliente.cpf || '').replace(/\D/g, ''),
          phones: [{ country: '55', area: ddd, number: numero, type: 'MOBILE' }],
        },
        items: [
          {
            reference_id: d.numeroPedido,
            name: `Pedido ${d.numeroPedido} — Prata 925`,
            quantity: 1,
            unit_amount: totalCent,
          },
        ],
        notification_urls: [`${appUrl}/api/webhook/pagbank`],
      }),
    })

    if (!res.ok) {
      console.error('[pagbank] orders falhou', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json().catch(() => ({}))) as {
      links?: { rel?: string; href?: string; media?: string }[]
    }
    const links = data.links || []
    const pay =
      links.find(l => l.rel === 'PAY')?.href ||
      links.find(l => l.media === 'text/html')?.href ||
      links[0]?.href ||
      null

    return pay ? { link: pay } : null
  } catch (e) {
    console.error('[pagbank] erro de rede:', e)
    return null
  }
}

// Cria link de pagamento específico do cadastro de revendedora (R$ 39,90).
// Inclui:
//   - reference_id = `cad_${revendedora_id}` → webhook usa pra ativar conta
//   - redirect_url = /auth/login?paid=1 → após pagar, PagBank manda de volta
//   - notification_url = /api/webhook/pagbank → confirma pagamento
// Retorna null se desativado/erro — caller usa fallback pag.ae estático.
export async function criarLinkCadastroPagBank(args: {
  revendedora_id: string
  nome: string
  email: string
  whatsapp?: string
}): Promise<{ link: string } | null> {
  if (!pagbankHabilitado()) return null

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lojadeprata925.com.br'

  const telefone = (args.whatsapp || '').replace(/\D/g, '')
  const ddd = telefone.slice(0, 2) || '11'
  const numero = telefone.slice(2) || '999999999'

  try {
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAGBANK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_id: `cad_${args.revendedora_id}`,
        customer: {
          name: args.nome,
          email: args.email,
          phones: telefone.length >= 10
            ? [{ country: '55', area: ddd, number: numero, type: 'MOBILE' }]
            : undefined,
        },
        items: [
          {
            reference_id: `cad_${args.revendedora_id}`,
            name: 'Ativação da loja — Prata 925',
            quantity: 1,
            unit_amount: 3990, // R$ 39,90 em centavos
          },
        ],
        notification_urls: [`${appUrl}/api/webhook/pagbank`],
        redirect_url: `${appUrl}/auth/login?paid=1`,
      }),
    })

    if (!res.ok) {
      console.error('[pagbank cadastro] orders falhou', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json().catch(() => ({}))) as {
      links?: { rel?: string; href?: string; media?: string }[]
    }
    const links = data.links || []
    const pay =
      links.find(l => l.rel === 'PAY')?.href ||
      links.find(l => l.media === 'text/html')?.href ||
      links[0]?.href ||
      null

    return pay ? { link: pay } : null
  } catch (e) {
    console.error('[pagbank cadastro] erro de rede:', e)
    return null
  }
}
