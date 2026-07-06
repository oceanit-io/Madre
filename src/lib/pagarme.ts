// Integração Pagar.me (Stone) — API v5. INATIVA até existir PAGARME_SECRET_KEY.
//
// Mesmo padrão do PagBank: sem a key é no-op total (nenhuma chamada externa,
// nenhum link), e o fluxo manual (WhatsApp / admin marca "pago") segue igual.
// NUNCA lança — o pedido não pode quebrar por causa do gateway.
//
// Aceita PIX + cartão de crédito via "Link de pagamento" hospedado da Pagar.me.
//
// Vercel envs (setar quando o banco liberar a API):
//   PAGARME_SECRET_KEY    -> sk_live_... (obrigatória p/ ativar; sk_test_... p/ testar)
//   PAGARME_MAX_PARCELAS  -> opcional, nº máx de parcelas SEM JUROS no cartão (default 1 = à vista)
//   PAGARME_PIX_EXPIRA_S  -> opcional, expiração do PIX em segundos (default 3600)
//   PAGARME_BASE_URL      -> opcional (default produção)
//
// Webhook: registrar no painel Pagar.me o evento `order.paid` apontando p/
//   {APP_URL}/api/webhook/pagarme   (opcional Basic auth — ver o route).
//
// Doc oficial: https://docs.pagar.me/reference/criar-link

const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

export function pagarmeHabilitado(): boolean {
  return !!process.env.PAGARME_SECRET_KEY
}

// Política de pagamento da REVENDEDORA:
//   false → revendedora NÃO entra no split do Pagar.me. Os 30% dela ficam na
//           conta mãe e ela é paga pelo MODELO INTERNO: comissão em
//           saldo_processando → liberada após 20 DIAS (anti-fraude/chargeback)
//           → saque PIX. Assim TODAS as revendedoras têm a retenção de 20 dias
//           uniforme. Prata 15 e conta mãe seguem recebendo direto pelo split.
//   true  → revendedora ativa (KYC) recebe os 30% DIRETO no split (sem os 20
//           dias). Era o comportamento antigo — desligado a pedido da Gabriela.
// Flip pra true só se decidir voltar a pagar a revendedora na hora pelo split.
//
// ATIVO (true): a revendedora ATIVA (KYC completo) recebe os 30% DIRETO pelo
// split do Pagar.me. A retenção de 20 dias é configurada no PAINEL do Pagar.me
// (prazo de liberação do recebedor), não no código. O trigger marca a comissão
// como 'paga' (comissao_via_split) e NÃO credita saldo interno — sem pagar 2x.
// Revendedora SEM recipient cai no modelo interno (saldo) como fallback.
export const REVENDEDORA_VIA_SPLIT = true

// Pagar.me usa Basic auth: base64("<secret_key>:") (key como user, senha vazia).
function authHeader(): string {
  const key = process.env.PAGARME_SECRET_KEY || ''
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

export type DadosCobranca = {
  numeroPedido: string
  total: number // em reais
  cliente: { nome: string; email: string; telefone: string; cpf: string }
  // URL pra onde a Pagar.me redireciona o comprador após pagar (volta pra loja).
  successUrl?: string
  // SPLIT em paymentlink Pagar.me. Pagar.me exige que UMA regra tenha
  // charge_remainder_fee/charge_processing_fee/liable=true — usamos a
  // CONTA MÃE (mainAccount) com essas flags. As outras (rev, prata15)
  // todas false.
  //
  // Montagem (até 3 regras):
  //   rev (se ativa)        → flat, all false
  //   prata15 (se setada)   → flat, all false
  //   mainAccount (sempre)  → flat = remainder, all true (obrigatória)
  //
  // ⚠️ Limitação Pagar.me v5: split em paymentlink só funciona pra
  // payment_method: credit_card. PIX no link vai 100% pra conta mãe.
  // Pra ter split em PIX também, migrar pra POST /v5/orders direto
  // (sem hosted checkout). Roadmap V2.
  split?: {
    revendedoraRecipientId?: string
    comissaoCentavos?: number
    prata15RecipientId?: string
    prata15Centavos?: number
    mainAccountRecipientId?: string
    mainAccountCentavos?: number
  }
}

// Parcelas SEM JUROS: cada parcela tem o mesmo `total` (= valor do pedido).
function montarParcelas(totalCent: number): { number: number; total: number }[] {
  const max = Math.max(1, Math.min(12, Number(process.env.PAGARME_MAX_PARCELAS) || 1))
  const parcelas: { number: number; total: number }[] = []
  for (let n = 1; n <= max; n++) parcelas.push({ number: n, total: totalCent })
  return parcelas
}

// ============================================================
// PIX DIRETO via /v5/orders — split FUNCIONA aqui (diferente de paymentlink).
// Retorna QR code + copia e cola pra renderizar no nosso checkout.
// ============================================================

export type DadosPix = {
  numeroPedido: string
  total: number // reais
  cliente: { nome: string; email: string; telefone: string; cpf: string }
  itens: Array<{ nome: string; quantidade: number; preco: number }> // preco em reais
  split?: DadosCobranca['split']
  endereco?: {
    rua: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    uf: string
    cep: string
  }
}

export type ResultadoPix = {
  orderId: string
  chargeId: string
  qrCodeUrl: string   // URL pública pra renderizar imagem do QR
  copiaECola: string  // string "BR copia e cola" pro app do banco
  expiraEm: string    // ISO timestamp (vazio se Pagar.me não devolver)
}

function soDigitos(s: string): string {
  return String(s || '').replace(/\D/g, '')
}

export async function criarPixPagarme(d: DadosPix): Promise<ResultadoPix | null> {
  if (!pagarmeHabilitado()) return null

  const totalCent = Math.round(Number(d.total || 0) * 100)
  if (totalCent <= 0) return null
  const pixExpira = Number(process.env.PAGARME_PIX_EXPIRA_S) || 3600

  const items = (d.itens || [])
    .map(i => ({
      code: (i.nome || 'item').slice(0, 64),
      description: (i.nome || 'Item').slice(0, 200),
      amount: Math.round(Number(i.preco || 0) * 100),
      quantity: Math.max(1, Number(i.quantidade || 1)),
    }))
    .filter(i => i.amount > 0)

  if (items.length === 0) {
    items.push({
      code: `pedido-${d.numeroPedido}`.slice(0, 64),
      description: `Pedido ${d.numeroPedido}`.slice(0, 200),
      amount: totalCent,
      quantity: 1,
    })
  }

  // Soma items × qty precisa bater com totalCent. Se não bate (frete não
  // está nos items), adiciona um item "Frete + ajuste" cobrindo a diff.
  const somaItens = items.reduce((s, x) => s + x.amount * x.quantity, 0)
  if (somaItens !== totalCent) {
    const diff = totalCent - somaItens
    if (diff > 0) {
      items.push({ code: 'frete', description: 'Frete', amount: diff, quantity: 1 })
    } else {
      // Soma > total: ajusta unitário do último item.
      const ult = items[items.length - 1]
      if (ult.quantity === 1) ult.amount += diff
      else items.push({ code: 'ajuste', description: 'Ajuste de arredondamento', amount: diff, quantity: 1 })
    }
  }

  const cpfDigits = soDigitos(d.cliente.cpf)
  const telDigits = soDigitos(d.cliente.telefone)
  const ddd = telDigits.slice(0, 2)
  const numero = telDigits.slice(2)

  // SPLIT 3-way — mesma estrutura do paymentlink, mas em /orders APLICA pra PIX.
  let splitBlock: Record<string, unknown> | null = null
  if (
    d.split &&
    d.split.mainAccountRecipientId &&
    d.split.mainAccountCentavos &&
    d.split.mainAccountCentavos > 0
  ) {
    const rules: Array<Record<string, unknown>> = []
    if (d.split.revendedoraRecipientId && d.split.comissaoCentavos && d.split.comissaoCentavos > 0) {
      rules.push({
        recipient_id: d.split.revendedoraRecipientId,
        amount: d.split.comissaoCentavos,
        type: 'flat',
        options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
      })
    }
    // Prata 15 (supplier) ABSORVE a taxa do Pagar.me (charge_processing_fee):
    // a empresa fica com ~65% líquido, e revendedora/conta mãe recebem LIMPO.
    // Se NÃO houver recebedor da Prata 15 no split, a conta mãe absorve
    // (fallback) — senão nenhum recebedor pagaria a taxa e o Pagar.me recusa.
    const prataAbsorveTaxa = !!(d.split.prata15RecipientId && d.split.prata15Centavos && d.split.prata15Centavos > 0)
    if (prataAbsorveTaxa) {
      rules.push({
        recipient_id: d.split.prata15RecipientId,
        amount: d.split.prata15Centavos,
        type: 'flat',
        options: { charge_processing_fee: true, charge_remainder_fee: true, liable: false },
      })
    }
    rules.push({
      recipient_id: d.split.mainAccountRecipientId,
      amount: d.split.mainAccountCentavos,
      type: 'flat',
      // conta mãe: liable por chargeback (dona da conta), mas só paga a taxa
      // se a Prata 15 não estiver no split (fallback).
      options: { charge_processing_fee: !prataAbsorveTaxa, charge_remainder_fee: !prataAbsorveTaxa, liable: true },
    })
    splitBlock = { split: rules }
  }

  const body = {
    code: d.numeroPedido, // webhook resolve pelo numero_pedido via data.code
    items,
    customer: {
      name: d.cliente.nome,
      email: d.cliente.email,
      type: 'individual',
      ...(cpfDigits.length === 11
        ? { document: cpfDigits, document_type: 'cpf' }
        : {}),
      ...(ddd && numero
        ? {
            phones: {
              mobile_phone: {
                country_code: '55',
                area_code: ddd,
                number: numero,
              },
            },
          }
        : {}),
      ...(d.endereco
        ? {
            address: {
              line_1: `${d.endereco.numero}, ${d.endereco.rua}`,
              line_2: d.endereco.complemento || '',
              zip_code: soDigitos(d.endereco.cep),
              city: d.endereco.cidade,
              state: d.endereco.uf,
              country: 'BR',
            },
          }
        : {}),
    },
    payments: [
      {
        payment_method: 'pix',
        pix: {
          expires_in: pixExpira,
          additional_information: [{ name: 'Pedido', value: d.numeroPedido }],
        },
        ...(splitBlock || {}),
      },
    ],
  }

  try {
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const raw = await res.text().catch(() => '')
    if (!res.ok) {
      console.error('[pagarme] PIX /orders falhou', res.status, raw.slice(0, 800))
      return null
    }
    type RespOrder = {
      id?: string
      charges?: Array<{
        id?: string
        last_transaction?: {
          qr_code?: string
          qr_code_url?: string
          expires_at?: string
        }
      }>
    }
    let parsed: RespOrder = {}
    try { parsed = JSON.parse(raw) as RespOrder } catch { /* */ }
    const charge = parsed.charges?.[0]
    const tx = charge?.last_transaction
    if (!tx?.qr_code || !tx?.qr_code_url) {
      console.error('[pagarme] PIX criado mas sem qr_code', JSON.stringify(parsed).slice(0, 500))
      return null
    }
    return {
      orderId: parsed.id || '',
      chargeId: charge?.id || '',
      qrCodeUrl: tx.qr_code_url,
      copiaECola: tx.qr_code,
      expiraEm: tx.expires_at || '',
    }
  } catch (e) {
    console.error('[pagarme] PIX erro de rede:', e)
    return null
  }
}

// Cria um link de pagamento Pagar.me (PIX + cartão). Retorna null se
// desativado/erro. `order_code` = numeroPedido → volta no webhook como data.code.
export async function criarLinkPagarme(
  d: DadosCobranca
): Promise<{ link: string; id: string } | null> {
  if (!pagarmeHabilitado()) return null

  const totalCent = Math.round(Number(d.total || 0) * 100)
  if (totalCent <= 0) return null
  const pixExpira = Number(process.env.PAGARME_PIX_EXPIRA_S) || 3600

  try {
    const res = await fetch(`${BASE}/paymentlinks`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'order',
        name: `Pedido ${d.numeroPedido} - Loja de Prata 925`.slice(0, 64),
        order_code: d.numeroPedido,
        payment_settings: {
          // SÓ cartão de crédito no paymentlink. PIX/débito via paymentlink
          // NÃO aplicam o split_settings (limitação Pagar.me) → cairiam 100%
          // na conta mãe sem repartir pra revendedora/Prata 15. O PIX do
          // checkout vai por OUTRO caminho (/api/pedidos/[id]/pix → /v5/orders
          // com split inline, que reparte certo). Então aqui: só credit_card.
          accepted_payment_methods: ['credit_card'],
          credit_card_settings: {
            operation_type: 'auth_and_capture',
            installments: montarParcelas(totalCent),
          },
          pix_settings: { expires_in: pixExpira },
        },
        cart_settings: {
          items: [
            {
              name: `Pedido ${d.numeroPedido}`.slice(0, 64),
              amount: totalCent,
              default_quantity: 1,
            },
          ],
        },
        customer_settings: {
          customer: {
            name: d.cliente.nome,
            email: d.cliente.email,
          },
        },
        // SPLIT: chave correta é `split_settings`. A Prata 15 (supplier)
        // ABSORVE a taxa (charge_processing_fee) → empresa líquida ~65% e
        // revendedora/conta mãe recebem LIMPO. Fallback: se não houver Prata 15,
        // a conta mãe paga a taxa (senão Pagar.me recusa sem ninguém liable).
        //
        // ⚠️ Só funciona pra credit_card. PIX/debit no link vai 100%
        // pra conta mãe (limitação Pagar.me) — por isso o link é só cartão.
        ...(d.split && d.split.mainAccountRecipientId && d.split.mainAccountCentavos && d.split.mainAccountCentavos > 0 ? (() => {
          const rules: Array<Record<string, unknown>> = []
          if (d.split.revendedoraRecipientId && d.split.comissaoCentavos && d.split.comissaoCentavos > 0) {
            rules.push({
              recipient_id: d.split.revendedoraRecipientId,
              amount: d.split.comissaoCentavos,
              type: 'flat',
              options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
            })
          }
          const prataAbsorveTaxa = !!(d.split.prata15RecipientId && d.split.prata15Centavos && d.split.prata15Centavos > 0)
          if (prataAbsorveTaxa) {
            rules.push({
              recipient_id: d.split.prata15RecipientId,
              amount: d.split.prata15Centavos,
              type: 'flat',
              options: { charge_processing_fee: true, charge_remainder_fee: true, liable: false },
            })
          }
          rules.push({
            recipient_id: d.split.mainAccountRecipientId,
            amount: d.split.mainAccountCentavos,
            type: 'flat',
            options: { charge_processing_fee: !prataAbsorveTaxa, charge_remainder_fee: !prataAbsorveTaxa, liable: true },
          })
          return { split_settings: { rules } }
        })() : {}),
        // Redireciona o comprador de volta pra loja após o pagamento.
        ...(d.successUrl ? { flow_settings: { success_url: d.successUrl } } : {}),
      }),
    })

    if (!res.ok) {
      console.error('[pagarme] paymentlinks falhou', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string }
    return data.url ? { link: data.url, id: data.id || '' } : null
  } catch (e) {
    console.error('[pagarme] erro de rede:', e)
    return null
  }
}
