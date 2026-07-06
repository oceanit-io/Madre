// Templates de e-mail (HTML inline, table-based — compatível com clientes
// de e-mail). Tema da loja: #1A1A1A / #FAFAFA / serifa nos títulos.

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function esc(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type ItemEmail = {
  nome: string
  sku?: string
  preco: number
  quantidade: number
  variacao?: string
  ref?: string
}

export type PedidoCriadoArgs = {
  numeroPedido: string
  nome: string
  itens: ItemEmail[]
  subtotal: number
  frete: number
  total: number
  endereco: {
    rua: string
    numero: string
    complemento?: string | null
    bairro: string
    cidade: string
    uf: string
    cep: string
  }
  revNome?: string | null
  waLink?: string | null
  pagbankLink?: string | null
}

export function pedidoCriadoClienteEmail(args: PedidoCriadoArgs): {
  subject: string
  html: string
} {
  const primeiroNome = (args.nome || '').split(' ')[0] || 'cliente'

  const linhasItens = args.itens
    .map(
      it => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;font-size:14px;color:#1A1A1A;">
          ${esc(it.nome)}${it.sku ? `<br><span style="font-size:12px;color:#999999;">SKU ${esc(it.sku)}</span>` : ''}${it.variacao ? `<br><span style="font-size:12px;color:#1A1A1A;font-weight:bold;">${esc(it.variacao)}</span>` : ''}${it.ref ? `<br><span style="font-size:12px;color:#999999;">Ref ${esc(it.ref)}</span>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;font-size:14px;color:#555555;text-align:center;white-space:nowrap;">
          ${it.quantidade} × ${formatBRL(it.preco)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;font-size:14px;color:#1A1A1A;text-align:right;white-space:nowrap;font-weight:bold;">
          ${formatBRL(it.preco * it.quantidade)}
        </td>
      </tr>`
    )
    .join('')

  const freteLinha =
    args.frete === 0
      ? `<span style="color:#15803D;font-weight:bold;">Grátis</span>`
      : formatBRL(args.frete)

  const enderecoTxt = `${esc(args.endereco.rua)}, ${esc(args.endereco.numero)}${
    args.endereco.complemento ? ', ' + esc(args.endereco.complemento) : ''
  }<br>${esc(args.endereco.bairro)}<br>${esc(args.endereco.cidade)}/${esc(
    args.endereco.uf
  )}<br>CEP ${esc(args.endereco.cep)}`

  // E-mail pré-pagamento: oferece SÓ o link de pagamento online. WhatsApp é
  // fallback escondido — só aparece se NÃO temos link online (cenário raro,
  // ex. Pagar.me caiu). Removido o botão WhatsApp do fluxo normal pra não
  // desviar o cliente da conversão (faz a venda perder força).
  const pagamentoBloco = args.pagbankLink
    ? `<p style="margin:0 0 12px;font-size:14px;color:#444444;line-height:1.6;">
         Pague online agora, rápido e seguro:
       </p>
       <a href="${esc(args.pagbankLink)}" target="_blank"
          style="display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;margin-bottom:8px;">
         💳 Pagar agora (cartão ou PIX)
       </a>
       <p style="margin:14px 0 0;font-size:13px;color:#777777;line-height:1.6;">
         Após o pagamento, você recebe a confirmação por e-mail.
       </p>`
    : args.waLink
      ? `<p style="margin:0 0 14px;font-size:14px;color:#444444;line-height:1.6;">
           Para concluir, combine o pagamento com ${args.revNome ? esc(args.revNome.split(' ')[0]) : 'a revendedora'} pelo WhatsApp:
         </p>
         <a href="${esc(args.waLink)}" target="_blank"
            style="display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;">
           Falar no WhatsApp e pagar
         </a>`
      : `<p style="margin:0;font-size:14px;color:#444444;line-height:1.6;">
           Para concluir, entre em contato com a revendedora para combinar o pagamento. 💎
         </p>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FAFAFA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr><td style="padding:8px 4px 20px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1A1A1A;letter-spacing:-0.3px;">
          Loja de Prata 925
        </td></tr>

        <tr><td style="background:#FFFFFF;border:1px solid #EEEEEE;border-radius:14px;padding:28px 26px;">

          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1A1A1A;margin-bottom:6px;">
            Pedido recebido! 💎
          </div>
          <p style="margin:0 0 18px;font-size:14px;color:#555555;line-height:1.6;">
            Oi ${esc(primeiroNome)}, recebemos o seu pedido.
            Anote o número:
          </p>

          <div style="background:#FAFAFA;border:1px solid #EEEEEE;border-radius:12px;padding:12px 16px;text-align:center;font-size:18px;font-weight:bold;color:#1A1A1A;letter-spacing:0.5px;margin-bottom:8px;">
            ${esc(args.numeroPedido)}
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <span style="display:inline-block;background:#FFF7ED;color:#C2410C;font-size:13px;font-weight:bold;padding:5px 14px;border-radius:999px;">
              Aguardando pagamento
            </span>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            ${linhasItens}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr><td style="font-size:14px;color:#555555;padding:4px 0;">Subtotal</td>
                <td style="font-size:14px;color:#555555;padding:4px 0;text-align:right;">${formatBRL(
                  args.subtotal
                )}</td></tr>
            <tr><td style="font-size:14px;color:#555555;padding:4px 0;">Frete</td>
                <td style="font-size:14px;color:#555555;padding:4px 0;text-align:right;">${freteLinha}</td></tr>
            <tr><td style="font-size:16px;color:#1A1A1A;font-weight:bold;padding:12px 0 0;border-top:1px solid #EEEEEE;">Total</td>
                <td style="font-size:20px;color:#1A1A1A;font-weight:bold;padding:12px 0 0;border-top:1px solid #EEEEEE;text-align:right;">${formatBRL(
                  args.total
                )}</td></tr>
          </table>

          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #EEEEEE;">
            <div style="font-size:12px;color:#999999;text-transform:uppercase;letter-spacing:1px;font-weight:bold;margin-bottom:8px;">
              Endereço de entrega
            </div>
            <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;">
              ${enderecoTxt}
            </p>
          </div>

          <div style="margin-top:24px;padding:18px;background:#FFF8E1;border:1px solid #FDE68A;border-radius:12px;">
            ${pagamentoBloco}
          </div>

        </td></tr>

        <tr><td style="padding:22px 4px;text-align:center;font-size:12px;color:#999999;line-height:1.6;">
          Loja de Prata 925 · Joias 925 · Prata legítima<br>
          Você recebeu este e-mail porque fez um pedido na nossa loja.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return {
    subject: `Pedido ${args.numeroPedido} recebido na Loja de Prata 925`,
    html,
  }
}

// ============================================================
// Loja ATIVADA → revendedora (bem-vinda + onboarding)
// ============================================================

export type LojaAtivadaArgs = {
  nome: string
  nomeLoja?: string | null
  subdominio: string
  appUrl?: string | null // default: NEXT_PUBLIC_APP_URL
}

export function lojaAtivadaEmail(args: LojaAtivadaArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'revendedora'
  const baseUrl = (
    args.appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://lojadeprata925.com.br'
  ).replace(/\/$/, '')
  const linkLoja = `${baseUrl}/loja/${encodeURIComponent(args.subdominio)}`
  const linkPainel = `${baseUrl}/dashboard`
  const linkGuia = `${baseUrl}/guia-revendedora.pdf`
  const nomeLoja = args.nomeLoja || `Loja da ${primeiro}`

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'Montserrat',-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(232,57,106,.08);">

        <tr><td style="background:linear-gradient(135deg,#E8396A 0%,#F4628C 100%);padding:36px 28px;text-align:center;color:#ffffff;">
          <div style="font-size:54px;line-height:1;margin-bottom:10px;">🎉</div>
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">
            Sua loja está ATIVA!
          </div>
          <div style="font-size:14px;opacity:.92;font-weight:500;">
            Bem-vinda à Loja de Prata 925, ${esc(primeiro)} 💎
          </div>
        </td></tr>

        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333333;">
            Confirmamos seu pagamento da taxa de ativação. <strong>Sua loja com mais de 3.000 peças de prata 925 já está no ar</strong> e pronta pra você começar a vender com <strong>30% de comissão</strong> em cada venda.
          </p>

          <div style="background:#FDE8EE;border:1px solid #F4C0D1;border-radius:12px;padding:18px;margin:18px 0;text-align:center;">
            <div style="font-size:11px;color:#E8396A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
              Seu link pra compartilhar
            </div>
            <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#1A1A1A;word-break:break-all;">
              ${esc(nomeLoja)}
            </div>
            <a href="${linkLoja}" style="display:inline-block;margin-top:10px;font-size:13px;color:#089C82;font-weight:600;word-break:break-all;text-decoration:none;">
              ${esc(linkLoja)}
            </a>
          </div>

          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${linkPainel}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;letter-spacing:.3px;">
              🚀 Acessar meu painel
            </a>
          </div>

          <div style="background:linear-gradient(135deg,#2a1020 0%,#3d1228 100%);border-radius:14px;padding:20px 18px;margin:20px 0 4px;text-align:center;">
            <div style="font-size:30px;line-height:1;margin-bottom:6px;">📲💖</div>
            <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:900;color:#ffffff;margin-bottom:4px;">
              Que alegria ter você com a gente, ${esc(primeiro)}!
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,.82);line-height:1.55;margin-bottom:14px;">
              Preparamos um guia direto ao ponto: <strong style="color:#F4628C;">do zero ao primeiro Pix</strong>. Tem scripts de WhatsApp, ideias de post e respostas prontas pra fechar venda. Bora? 🚀
            </div>
            <a href="${linkGuia}" style="display:inline-block;background:#ffffff;color:#E8396A;text-decoration:none;font-weight:800;font-size:14px;padding:13px 26px;border-radius:11px;letter-spacing:.3px;">
              📖 Baixar o Guia da Revendedora
            </a>
          </div>

          <div style="margin-top:24px;padding:16px 18px;background:#FAF8F5;border-radius:12px;font-size:13px;color:#555555;line-height:1.75;">
            <div style="font-weight:700;color:#1A1A1A;margin-bottom:6px;">Primeiros passos:</div>
            1️⃣ Personalize sua loja (nome, cor, logo) no painel<br>
            2️⃣ Compartilhe seu link no WhatsApp, Instagram, grupos<br>
            3️⃣ A cliente compra direto da sua loja<br>
            4️⃣ Você recebe 30% via Pix. A liberação é 20 dias após o pagamento (esse prazo cobre eventuais trocas ou devoluções da venda)
          </div>

          <p style="margin:20px 0 0;font-size:13px;color:#777777;line-height:1.6;">
            Qualquer dúvida, estamos aqui pra te ajudar. Bora faturar! 💖
          </p>
        </td></tr>

        <tr><td style="padding:22px 28px 28px;text-align:center;font-size:11px;color:#999999;line-height:1.6;border-top:1px solid #F0F0F0;">
          Loja de Prata 925 · Revendedoras<br>
          Você recebeu este e-mail porque sua conta foi ativada.
        </td></tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`

  return {
    subject: `🎉 Sua loja na Loja de Prata 925 está ativa, ${primeiro}!`,
    html,
  }
}

// ============================================================
// MENSAGEM DIÁRIA (motivacional) → revendedora, 7h
// ============================================================

export type MensagemDiariaArgs = {
  nome: string
  mensagem: string
  appUrl?: string | null
}

export function mensagemDiariaEmail(args: MensagemDiariaArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'revendedora'
  const painel = painelDashboard(args.appUrl)
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#333333;">
      Bom dia, ${esc(primeiro)}! 💖
    </p>
    <div style="background:#FDE8EE;border:1px solid #F4C0D1;border-radius:12px;padding:18px;margin:0 0 20px;font-size:16px;font-weight:700;color:#1A1A1A;line-height:1.55;text-align:center;">
      ${esc(args.mensagem)}
    </div>
    <div style="text-align:center;margin:20px 0 4px;">
      <a href="${painel}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">
        🚀 Abrir minha loja
      </a>
    </div>`
  return {
    subject: `☀️ ${primeiro}, seu recadinho de hoje pra vender`,
    html: cascaRevendedora('💌', 'Mensagem do dia', `Bora faturar, ${esc(primeiro)}!`, inner),
  }
}

// ============================================================
// Shells reutilizáveis (cliente = tema loja serifa; revendedora = rosa)
// ============================================================

function cascaCliente(inner: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FAFAFA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:8px 4px 20px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1A1A1A;letter-spacing:-0.3px;">
          Loja de Prata 925
        </td></tr>
        <tr><td style="background:#FFFFFF;border:1px solid #EEEEEE;border-radius:14px;padding:28px 26px;">
          ${inner}
        </td></tr>
        <tr><td style="padding:22px 4px;text-align:center;font-size:12px;color:#999999;line-height:1.6;">
          Loja de Prata 925 · Joias 925 · Prata legítima
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function cascaRevendedora(emoji: string, titulo: string, sub: string, inner: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'Montserrat',-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF8F5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(232,57,106,.08);">
        <tr><td style="background:linear-gradient(135deg,#E8396A 0%,#F4628C 100%);padding:32px 28px;text-align:center;color:#ffffff;">
          <div style="font-size:48px;line-height:1;margin-bottom:8px;">${emoji}</div>
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:.3px;">
            ${titulo}
          </div>
          ${sub ? `<div style="font-size:14px;opacity:.92;font-weight:500;margin-top:6px;">${sub}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px;">
          ${inner}
        </td></tr>
        <tr><td style="padding:22px 28px 28px;text-align:center;font-size:11px;color:#999999;line-height:1.6;border-top:1px solid #F0F0F0;">
          Loja de Prata 925 · Revendedoras
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function painelDashboard(painelUrl?: string | null): string {
  return (
    (painelUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://lojadeprata925.com.br')
      .replace(/\/$/, '') + '/dashboard'
  )
}

// ============================================================
// PAGAMENTO CONFIRMADO → cliente
// ============================================================

export type PagamentoClienteArgs = {
  numeroPedido: string
  nome: string
  total: number
  waLink?: string | null
}

export function pagamentoConfirmadoClienteEmail(args: PagamentoClienteArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'cliente'
  const waBtn = args.waLink
    ? `<div style="text-align:center;margin-top:20px;">
         <a href="${esc(args.waLink)}" target="_blank" style="display:inline-block;background:#1FAD52;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;">Falar no WhatsApp</a>
       </div>`
    : ''
  const inner = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1A1A1A;margin-bottom:6px;">
      Pagamento confirmado! ✅
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#555555;line-height:1.6;">
      Oi ${esc(primeiro)}, recebemos o pagamento do seu pedido <strong>${esc(args.numeroPedido)}</strong>. Ele já entrou em preparação 💎
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:16px;color:#1A1A1A;font-weight:bold;padding:12px 0;border-top:1px solid #EEEEEE;border-bottom:1px solid #EEEEEE;">Total pago</td>
          <td style="font-size:18px;color:#15803D;font-weight:bold;padding:12px 0;border-top:1px solid #EEEEEE;border-bottom:1px solid #EEEEEE;text-align:right;">${formatBRL(args.total)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#777777;line-height:1.6;">
      Você receberá um novo aviso quando o pedido for enviado. Qualquer dúvida, fale com a revendedora.
    </p>
    ${waBtn}`
  return {
    subject: `Pagamento confirmado! Pedido ${args.numeroPedido} 💎`,
    html: cascaCliente(inner),
  }
}

// ============================================================
// PEDIDO ENVIADO → cliente
// ============================================================

export type EnviadoClienteArgs = {
  numeroPedido: string
  nome: string
  revNome?: string | null
  waLink?: string | null
  codigoRastreio?: string | null
  pedidoUrl?: string | null   // página de acompanhamento do pedido
}

export function pedidoEnviadoClienteEmail(args: EnviadoClienteArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'cliente'
  const revPrimeiro = (args.revNome || '').split(' ')[0]
  const cod = (args.codigoRastreio || '').trim()

  // Bloco de rastreio: código + botão "Rastrear meu pedido" (pra página de
  // acompanhamento, se houver) e/ou link direto dos Correios.
  const correiosLink = cod ? `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(cod)}` : ''
  const rastreioBloco = cod
    ? `<div style="background:#F5F7FA;border:1px solid #E3E8EF;border-radius:12px;padding:14px 16px;margin:18px 0;">
         <div style="font-size:12px;color:#8794A5;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Código de rastreio</div>
         <div style="font-family:monospace;font-size:18px;font-weight:bold;color:#1A1A1A;letter-spacing:1px;">${esc(cod)}</div>
       </div>`
    : ''
  const acompanharBtn = args.pedidoUrl
    ? `<a href="${esc(args.pedidoUrl)}" target="_blank" style="display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;margin:4px 6px;">📦 Acompanhar meu pedido</a>`
    : ''
  const correiosBtn = correiosLink
    ? `<a href="${correiosLink}" target="_blank" style="display:inline-block;background:#005DAA;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;margin:4px 6px;">Ver nos Correios</a>`
    : ''
  const waBtn = args.waLink
    ? `<a href="${esc(args.waLink)}" target="_blank" style="display:inline-block;background:#1FAD52;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;padding:13px 22px;border-radius:12px;margin:4px 6px;">Falar no WhatsApp</a>`
    : ''
  const botoes = (acompanharBtn || correiosBtn || waBtn)
    ? `<div style="text-align:center;margin-top:18px;">${acompanharBtn}${correiosBtn}${waBtn}</div>`
    : ''

  const inner = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1A1A1A;margin-bottom:6px;">
      Seu pedido foi enviado! 📦
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#555555;line-height:1.6;">
      Oi ${esc(primeiro)}, boa notícia: o pedido <strong>${esc(args.numeroPedido)}</strong> saiu para entrega 🚚
    </p>
    ${rastreioBloco}
    <p style="margin:0;font-size:13px;color:#777777;line-height:1.6;">
      ${cod ? 'Acompanhe o trajeto pelos botões abaixo.' : 'Em breve chega até você.'} Qualquer dúvida sobre o envio${revPrimeiro ? `, fale com ${esc(revPrimeiro)}` : ''} pelo WhatsApp. 💎
    </p>
    ${botoes}`
  return {
    subject: `Seu pedido ${args.numeroPedido} foi enviado! 📦`,
    html: cascaCliente(inner),
  }
}

// ============================================================
// NOVA VENDA → revendedora (pedido criado na loja dela)
// ============================================================

export type NovaVendaRevArgs = {
  numeroPedido: string
  revNome: string
  clienteNome: string
  total: number
  painelUrl?: string | null
}

export function novaVendaRevendedoraEmail(args: NovaVendaRevArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.revNome || '').split(' ')[0] || 'revendedora'
  const cliente = (args.clienteNome || '').split(' ')[0] || 'uma cliente'
  const link = painelDashboard(args.painelUrl)
  const inner = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333333;">
      Parabéns, <strong>${esc(primeiro)}</strong>! 💖 Caiu um pedido novo na sua loja.
    </p>
    <div style="background:#FDE8EE;border:1px solid #F4C0D1;border-radius:12px;padding:18px;margin:8px 0 18px;">
      <div style="font-size:11px;color:#E8396A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Pedido ${esc(args.numeroPedido)}</div>
      <div style="font-size:14px;color:#555;">Cliente: <strong style="color:#1A1A1A;">${esc(cliente)}</strong></div>
      <div style="font-size:22px;color:#1A1A1A;font-weight:900;margin-top:4px;">${formatBRL(args.total)}</div>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.6;">
      O pedido está <strong>aguardando pagamento</strong>. Entre em contato com a cliente pra fechar e faturar! 🚀
    </p>
    <div style="text-align:center;margin:22px 0 4px;">
      <a href="${link}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">Ver no meu painel</a>
    </div>`
  return {
    subject: `🎉 Nova venda na sua loja! Pedido ${args.numeroPedido}`,
    html: cascaRevendedora('🎉', 'Nova venda!', `Pedido ${esc(args.numeroPedido)}`, inner),
  }
}

// ============================================================
// PAGAMENTO CONFIRMADO → revendedora (hora de enviar + comissão)
// ============================================================

export type PagamentoRevArgs = {
  numeroPedido: string
  revNome: string
  clienteNome: string
  total: number
  painelUrl?: string | null
}

export function pagamentoRevendedoraEmail(args: PagamentoRevArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.revNome || '').split(' ')[0] || 'revendedora'
  const cliente = (args.clienteNome || '').split(' ')[0] || 'a cliente'
  const link = painelDashboard(args.painelUrl)
  const inner = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333333;">
      <strong>${esc(primeiro)}</strong>, o pagamento do pedido <strong>${esc(args.numeroPedido)}</strong> (cliente ${esc(cliente)}) foi confirmado! 💰
    </p>
    <div style="background:#E7F8EF;border:1px solid #B6E6CC;border-radius:12px;padding:18px;margin:8px 0 18px;text-align:center;">
      <div style="font-size:11px;color:#089C82;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Valor da venda</div>
      <div style="font-size:24px;color:#1A1A1A;font-weight:900;">${formatBRL(args.total)}</div>
      <div style="font-size:12px;color:#555;margin-top:6px;">Sua comissão de 30% já foi creditada (liberação em 20 dias).</div>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.6;">
      Agora é só <strong>preparar o envio</strong> pra cliente. 📦
    </p>
    <div style="text-align:center;margin:22px 0 4px;">
      <a href="${link}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">Ver no meu painel</a>
    </div>`
  return {
    subject: `💰 Pagamento confirmado! Pedido ${args.numeroPedido}`,
    html: cascaRevendedora('💰', 'Pagamento confirmado!', `Pedido ${esc(args.numeroPedido)}`, inner),
  }
}

// ============================================================
// Cadastro recebido — disparado quando rev termina /auth/register
// (antes de pagar). Confirma que conta foi criada e dá o link
// de pagamento PagBank pra ela não se perder.
// ============================================================

const VALOR_ATIVACAO = 'R$ 39,90'
// Link estático InfinitePay (suporta Apple Pay, PIX, cartão).
const LINK_PAGBANK = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'

export type CadastroRecebidoArgs = {
  nome: string
  linkPagamento?: string // opcional, mantido por compat com chamadores
  appUrl?: string | null
}

export function cadastroRecebidoEmail(args: CadastroRecebidoArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'tudo bem'
  const loginUrl = ((args.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://lojadeprata925.com.br') + '/auth/login').replace(/\/\/+auth/, '/auth')

  const inner = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#333333;">
      Olá <strong>${esc(primeiro)}</strong>! Tua conta na <strong>Loja de Prata 925</strong> foi criada com sucesso. ✨
    </p>
    <p style="margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#444;">
      Falta só <strong>1 passo</strong> pra ativar tua loja completa com mais de
      <strong>3.000 peças de prata 925</strong>: a taxa única de ativação de
      <strong>${VALOR_ATIVACAO}</strong>.
    </p>

    <div style="background:#FDE8EE;border:1px solid #F4C0D1;border-radius:14px;padding:18px;margin:18px 0;text-align:center;">
      <div style="font-size:10px;color:#9B2C5A;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;">
        Taxa única de ativação
      </div>
      <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:900;color:#E8396A;line-height:1.1;margin-bottom:6px;">
        ${VALOR_ATIVACAO}
      </div>
      <div style="font-size:12px;color:#777;">PIX, boleto ou cartão · só 1x</div>
    </div>

    <div style="text-align:center;margin:22px 0 14px;">
      <a href="${args.linkPagamento || LINK_PAGBANK}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:15px 32px;border-radius:14px;letter-spacing:.3px;text-transform:uppercase;">
        💳 Pagar agora via PagBank
      </a>
    </div>

    <p style="margin:14px 0 0;font-size:12.5px;line-height:1.65;color:#666;text-align:center;">
      Após o pagamento ativamos tua loja em até 1 hora útil. Tu recebe outro email confirmando.
    </p>

    <div style="margin-top:24px;padding:14px 16px;background:#FAF8F5;border-radius:10px;font-size:13px;color:#555;line-height:1.7;">
      <div style="font-weight:700;color:#1A1A1A;margin-bottom:4px;">Por que vale a pena?</div>
      ✓ Catálogo oficial Prata 15 com 3.000+ peças<br>
      ✓ Tu ganha <strong>30% de comissão</strong> em cada venda<br>
      ✓ Sem estoque, sem despachar nada. A gente cuida disso<br>
      ✓ Loja personalizável (cor, fonte, logo, banner)
    </div>

    <p style="margin:22px 0 4px;font-size:12px;color:#999;text-align:center;line-height:1.6;">
      Dúvidas? Fala com a gente no WhatsApp: <a href="https://wa.me/5511975427321" style="color:#25D366;text-decoration:none;font-weight:700;">(11) 97542-7321</a><br>
      Já paguei? Acessa <a href="${loginUrl}" style="color:#E8396A;text-decoration:none;font-weight:600;">${loginUrl}</a>
    </p>
  `

  return {
    subject: `✨ Conta criada, ${primeiro}! Falta 1 passo pra tua loja`,
    html: cascaRevendedora('✨', 'Conta criada!', `Bem-vinda, ${esc(primeiro)} 💎`, inner),
  }
}

// ============================================================
// Lembrete 24h — disparado pelo cron diário pra revendedoras que
// cadastraram mas ainda não pagaram (status='pendente'). Reativa
// a conversão "cadastrou → pagou".
// ============================================================

export type LembreteCadastroArgs = {
  nome: string
  linkPagamento?: string // opcional, default = link estático
  appUrl?: string | null
}

export function lembreteCadastro24hEmail(args: LembreteCadastroArgs): {
  subject: string
  html: string
} {
  const primeiro = (args.nome || '').split(' ')[0] || 'olá'

  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#333333;">
      Oi <strong>${esc(primeiro)}</strong>! Vi que tu se cadastrou ontem mas ainda não ativou tua loja. 👋
    </p>
    <p style="margin:0 0 18px;font-size:14.5px;line-height:1.7;color:#444;">
      Falta só pagar a taxa única de <strong>${VALOR_ATIVACAO}</strong> pra ter acesso ao catálogo completo e começar a vender com <strong>30% de comissão</strong>.
    </p>

    <div style="text-align:center;margin:22px 0;">
      <a href="${args.linkPagamento || LINK_PAGBANK}" style="display:inline-block;background:#E8396A;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:15px 32px;border-radius:14px;letter-spacing:.3px;text-transform:uppercase;">
        💳 Ativar minha loja por ${VALOR_ATIVACAO}
      </a>
    </div>

    <div style="margin:24px 0 16px;padding:16px 18px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;font-size:13px;color:#78350F;line-height:1.65;">
      💡 <strong>Sabia que…</strong><br>
      Revendedoras que ativam no 1º dia faturam em média <strong>2x mais</strong> no 1º mês do que quem demora.
    </div>

    <p style="margin:0 0 4px;font-size:12.5px;color:#888;line-height:1.6;text-align:center;">
      Mudou de ideia? Sem stress, é só ignorar esse e-mail. Não cobramos nada extra.
    </p>
  `

  return {
    subject: `💎 ${primeiro}, tua loja tá esperando, só falta ${VALOR_ATIVACAO}`,
    html: cascaRevendedora('💎', 'Tua loja tá esperando!', `${esc(primeiro)}, vamos ativar?`, inner),
  }
}
