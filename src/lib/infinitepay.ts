// Integração com InfinitePay (CloudWalk) — gera link de checkout por
// pedido/cadastro com order_nsu pra rastrear via webhook.
//
// Docs: https://api.checkout.infinitepay.io/links (POST)
// Autenticação: somente "handle" (InfiniteTag) no payload — não precisa
// de token. Isso significa que qualquer um com nosso handle pode criar
// links pra nossa conta, mas o dinheiro sempre vai pra nós então é
// seguro por design.
//
// Configuração via env:
//   INFINITEPAY_HANDLE         → nosso handle (default: 'oceanit')
//   APP_URL                    → base pública pra webhook + redirect

const HANDLE_DEFAULT = 'oceanit'
const API_BASE = 'https://api.checkout.infinitepay.io'

export function infinitepayHandle(): string {
  return process.env.INFINITEPAY_HANDLE || HANDLE_DEFAULT
}

type ItemPedido = {
  quantity: number
  price: number // em centavos
  description: string
}

type DadosCheckout = {
  items: ItemPedido[]
  order_nsu: string // nosso reference_id pra reconhecer no webhook
  customer?: {
    name?: string
    email?: string
    phone_number?: string
  }
  redirect_url?: string
  webhook_url?: string
}

/**
 * Cria link de checkout InfinitePay. Retorna a URL pública pro
 * cliente pagar, ou null em caso de erro (caller deve usar fallback).
 */
export async function criarLinkInfinitePay(args: DadosCheckout): Promise<{ url: string } | null> {
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lojadeprata925.com.br'

  const payload = {
    handle: infinitepayHandle(),
    items: args.items,
    order_nsu: args.order_nsu,
    redirect_url: args.redirect_url || `${appUrl}/auth/login?paid=1`,
    webhook_url: args.webhook_url || `${appUrl}/api/webhook/infinitepay`,
    ...(args.customer ? { customer: args.customer } : {}),
  }

  try {
    const res = await fetch(`${API_BASE}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[infinitepay] criar link falhou', res.status, txt.slice(0, 500))
      return null
    }

    const data = (await res.json().catch(() => ({}))) as {
      url?: string
      checkout_url?: string
      link?: string
    }
    const url = data.url || data.checkout_url || data.link || null
    return url ? { url } : null
  } catch (e) {
    console.error('[infinitepay] erro de rede:', e)
    return null
  }
}

/**
 * Cria checkout específico do cadastro de revendedora (R$ 39,90).
 * order_nsu = `cad_<revendedora_id>` → webhook identifica e ativa
 * a conta automaticamente.
 */
export async function criarLinkCadastroInfinitePay(args: {
  revendedora_id: string
  nome: string
  email: string
  whatsapp?: string
}): Promise<{ url: string } | null> {
  const telefone = (args.whatsapp || '').replace(/\D/g, '')
  // InfinitePay quer telefone E.164 (+55...). Se tiver pelo menos DDI+DDD+8 dígitos.
  const phone = telefone.length >= 10 ? `+55${telefone}` : undefined

  return criarLinkInfinitePay({
    items: [{
      quantity: 1,
      price: 3990, // R$ 39,90 em centavos
      description: 'Ativação da loja — Loja de Prata 925',
    }],
    order_nsu: `cad_${args.revendedora_id}`,
    customer: {
      name: args.nome,
      email: args.email,
      ...(phone ? { phone_number: phone } : {}),
    },
  })
}

/**
 * Confirma se um pagamento foi realmente realizado consultando a API
 * (proteção contra webhook forjado). Opcional pra v1.
 */
export async function verificarPagamentoInfinitePay(args: {
  order_nsu: string
  transaction_nsu: string
  invoice_slug: string
}): Promise<{ paid: boolean; amount?: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/payment_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: infinitepayHandle(),
        order_nsu: args.order_nsu,
        transaction_nsu: args.transaction_nsu,
        slug: args.invoice_slug,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { paid?: boolean; amount?: number }
    return { paid: !!data.paid, amount: data.amount }
  } catch {
    return null
  }
}
