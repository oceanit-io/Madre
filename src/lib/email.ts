// Envío de email transaccional vía Resend (API HTTP, sin dependencias).
//
// Tolerante a fallos por diseño: si falta RESEND_API_KEY o la API falla,
// NO lanza excepción ni rompe el flujo que lo llamó (el pedido se crea
// igual). Solo loguea.
//
// Config (Vercel env + .env.local):
//   RESEND_API_KEY   -> obligatoria para que envíe de verdad
//   EMAIL_FROM       -> opcional, ej: "Prata 925 <pedidos@seudominio.com>"
//                       (default: onboarding@resend.dev — solo testing,
//                        Resend solo entrega a tu próprio email hasta
//                        verificar un domínio)

import { brand } from '@/lib/brand'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// Cópia de monitoramento: toda comunicação enviada vai em BCC pra esse
// endereço, pra Gabriela acompanhar tudo (boas-vindas, pedidos, etc.) sem
// mexer em cada template. Override via env MONITOR_EMAIL_BCC; '' desliga.
function monitorBcc(): string {
  const v = process.env.MONITOR_EMAIL_BCC
  return v === undefined ? 'gabyfernandezmun@gmail.com' : v.trim()
}

// Nome de exibição do remetente — vem da marca (brand.nome), independente do
// que estiver no EMAIL_FROM. PRESERVA o endereço do EMAIL_FROM, que precisa
// ser do domínio verificado no Resend pra entregar pros compradores (se for
// @resend.dev, só chega pra conta dona).
const FROM_NOME = brand.nome
function montarFrom(): string {
  const env = (process.env.EMAIL_FROM || '').trim()
  const m = env.match(/<([^>]+)>/)
  const endereco = m ? m[1].trim() : (env.includes('@') ? env : 'onboarding@resend.dev')
  return `${FROM_NOME} <${endereco}>`
}

export type EnviarEmailArgs = {
  to: string
  subject: string
  html: string
  replyTo?: string
  // Pula a cópia de monitoramento (BCC). Usado em envios em massa (ex.
  // mensagem diária pra todas), pra não gerar dezenas de cópias por dia.
  pularCopiaMonitor?: boolean
}

export type EnviarEmailResultado =
  | { ok: true; id: string }
  | { ok: false; motivo: string }

export async function enviarEmail(
  args: EnviarEmailArgs
): Promise<EnviarEmailResultado> {
  const apiKey = process.env.RESEND_API_KEY
  const from = montarFrom()

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY ausente — e-mail NÃO enviado:', args.subject)
    return { ok: false, motivo: 'sem_api_key' }
  }

  if (!args.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
    return { ok: false, motivo: 'destinatario_invalido' }
  }

  // BCC de monitoramento — exceto quando o próprio destinatário já é o
  // endereço de monitoramento (evita auto-cópia redundante).
  const bccMonitor = monitorBcc()
  const bcc =
    !args.pularCopiaMonitor &&
    bccMonitor &&
    bccMonitor.toLowerCase() !== args.to.toLowerCase()
      ? [bccMonitor]
      : []

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        ...(bcc.length ? { bcc } : {}),
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[email] Resend respondeu', res.status, txt)
      // Incluímos uma fatia do body no motivo p/ ajudar a debugar
      // direto pelo response — sem precisar olhar Vercel logs.
      const detalhe = txt.slice(0, 240).replace(/\s+/g, ' ').trim()
      return { ok: false, motivo: `http_${res.status} ${detalhe}` }
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id || '' }
  } catch (e) {
    console.error('[email] Falha de rede ao enviar:', e)
    return { ok: false, motivo: 'erro_rede' }
  }
}
