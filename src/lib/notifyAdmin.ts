// Helpers pra notificar a admin (Gabriela) sobre eventos que precisam
// de atenção rápida — principalmente pagamentos que chegaram mas que
// o sistema não conseguiu auto-ativar (caso comum com link estático
// InfinitePay onde o webhook vem sem order_nsu identificável).
//
// Usa o mesmo enviarEmail existente em /lib/email. Best-effort — se
// falhar não bloqueia nada.

import { enviarEmail } from './email'
import { supabaseAdmin } from './supabaseAdmin'

const ADMIN_EMAIL =
  (process.env.ADMIN_EMAILS || '').split(',')[0].trim() ||
  'gabyfernandezweb@gmail.com'

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://lojadeprata925.com.br'

/** Salva alerta no DB pra aparecer no banner do /admin. Best-effort. */
async function salvarAlertaDB(args: {
  tipo: string
  titulo: string
  mensagem?: string
  detalhes?: Record<string, unknown>
  link?: string
}) {
  try {
    await supabaseAdmin().from('admin_alertas').insert({
      tipo: args.tipo,
      titulo: args.titulo,
      mensagem: args.mensagem ?? null,
      detalhes: args.detalhes ?? null,
      link: args.link ?? null,
    })
  } catch (e) {
    console.error('[notify-admin] falha insert admin_alertas:', e)
  }
}

/**
 * Avisa que chegou um pagamento via webhook mas não conseguimos
 * identificar a revendedora. Gabriela precisa achar e ativar manual.
 */
export async function notificarPagamentoSemMatch(args: {
  amount: number       // em centavos
  paid_amount: number  // em centavos
  capture_method?: string
  transaction_nsu?: string
  order_nsu?: string
  receipt_url?: string
  customer_email?: string
  customer_name?: string
  raw_payload?: unknown
}): Promise<void> {
  try {
    const valor = (args.paid_amount / 100).toFixed(2).replace('.', ',')
    const adminUrl = `${APP_URL}/admin/ativar`
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:14px;padding:28px 24px;border:1px solid #E5E5E5;">
    <div style="font-size:30px;margin-bottom:12px;">💰</div>
    <h1 style="margin:0 0 6px;font-size:20px;color:#0F172A;font-weight:800;">Pagamento recebido!</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#64748B;">
      InfinitePay confirmou um pagamento mas o sistema não conseguiu identificar a revendedora automaticamente.
    </p>

    <table style="width:100%;border-collapse:collapse;background:#FAFAFA;border-radius:10px;font-size:13px;color:#1A1A1A;margin-bottom:18px;">
      <tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Valor pago</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;font-weight:700;">R$ ${valor}</td></tr>
      ${args.capture_method ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Método</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;">${args.capture_method}</td></tr>` : ''}
      ${args.customer_email ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Email do cliente</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;"><strong>${args.customer_email}</strong></td></tr>` : ''}
      ${args.customer_name ? `<tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Nome</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;">${args.customer_name}</td></tr>` : ''}
      ${args.transaction_nsu ? `<tr><td style="padding:8px 14px;">Transaction NSU</td><td style="padding:8px 14px;text-align:right;font-family:monospace;font-size:11px;">${args.transaction_nsu}</td></tr>` : ''}
    </table>

    ${args.customer_email ? `
    <p style="margin:0 0 12px;font-size:13px;color:#444;">
      💡 <strong>Confere se o email <code style="background:#FEF3C7;padding:2px 6px;border-radius:4px;">${args.customer_email}</code> bate com alguma pendente no painel.</strong>
    </p>` : `
    <p style="margin:0 0 12px;font-size:13px;color:#444;">
      💡 Verifique no painel InfinitePay quem fez o pagamento e ative a revendedora correspondente.
    </p>`}

    <div style="text-align:center;margin:22px 0 6px;">
      <a href="${adminUrl}" style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:10px;font-size:14px;">
        🚀 Abrir /admin/ativar
      </a>
    </div>

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #EEE;font-size:11px;color:#94A3B8;">
      Notificação automática da plataforma. Webhook payload completo no log da Vercel.
    </div>
  </div>
</body>
</html>`

    await enviarEmail({
      to: ADMIN_EMAIL,
      subject: `💰 Pagamento R$ ${valor} recebido — precisa ativar manual`,
      html,
    })
  } catch (e) {
    console.error('[notify-admin] falha email pagamento-sem-match:', e)
  }

  // Salva também no banco pra aparecer no banner do /admin
  await salvarAlertaDB({
    tipo: 'pagamento_sem_match',
    titulo: `💰 Pagamento R$ ${(args.paid_amount / 100).toFixed(2).replace('.', ',')} recebido — ativar manual`,
    mensagem: args.customer_email
      ? `Email cliente: ${args.customer_email}${args.customer_name ? ` · ${args.customer_name}` : ''}`
      : 'Não veio email do cliente. Confere InfinitePay.',
    detalhes: {
      paid_amount: args.paid_amount,
      capture_method: args.capture_method,
      transaction_nsu: args.transaction_nsu,
      order_nsu: args.order_nsu,
      customer_email: args.customer_email,
      customer_name: args.customer_name,
      receipt_url: args.receipt_url,
    },
    link: '/admin/ativar',
  })
}

/**
 * Avisa quando uma revendedora pendente faz login no dashboard.
 * Indica que ela talvez tenha pagado e tá tentando ver a loja.
 * Admin pode reagir rápido.
 */
export async function notificarPendenteLogou(args: {
  nome: string
  email: string
  cadastro_em: string
}): Promise<void> {
  try {
    const adminUrl = `${APP_URL}/admin/ativar`
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:14px;padding:24px 22px;border:1px solid #E5E5E5;">
    <div style="font-size:28px;margin-bottom:10px;">⏰</div>
    <h1 style="margin:0 0 6px;font-size:18px;color:#0F172A;font-weight:800;">Pendente logou agora</h1>
    <p style="margin:0 0 16px;font-size:13px;color:#64748B;">
      Pode ter pagado e tá esperando ativação. Confere no InfinitePay.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#FAFAFA;border-radius:10px;font-size:13px;margin-bottom:18px;">
      <tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Nome</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;font-weight:700;">${args.nome}</td></tr>
      <tr><td style="padding:8px 14px;border-bottom:1px solid #EEE;">Email</td><td style="padding:8px 14px;border-bottom:1px solid #EEE;text-align:right;">${args.email}</td></tr>
      <tr><td style="padding:8px 14px;">Cadastro</td><td style="padding:8px 14px;text-align:right;">${args.cadastro_em}</td></tr>
    </table>
    <div style="text-align:center;">
      <a href="${adminUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:13px;">
        Ver pendentes
      </a>
    </div>
  </div>
</body>
</html>`

    await enviarEmail({
      to: ADMIN_EMAIL,
      subject: `⏰ ${args.nome} (pendente) logou agora`,
      html,
    })
  } catch (e) {
    console.error('[notify-admin] falha email pendente-logou:', e)
  }

  await salvarAlertaDB({
    tipo: 'pendente_logou',
    titulo: `⏰ ${args.nome} (pendente) logou agora`,
    mensagem: `${args.email} · cadastro ${args.cadastro_em}. Pode ter pagado, confere InfinitePay.`,
    detalhes: { nome: args.nome, email: args.email, cadastro_em: args.cadastro_em },
    link: '/admin/ativar',
  })
}
