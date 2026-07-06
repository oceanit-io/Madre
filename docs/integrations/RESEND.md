# Integração Resend

Envio de emails transacionais (pedido recebido, pagamento confirmado, etc.).

## 📌 Visão geral

- **Provedor**: Resend (resend.com).
- **Tier**: Free (100 emails/dia, suficiente pro MVP).
- **Domínio remetente**: `lojadeprata925.com.br` (verificado).
- **Lib**: `lib/email.ts` (cliente) + `lib/emailTemplates.ts` (HTML).
- **Disparo**: chamadas a `enviarEmail()` em `lib/pedidoEmails.ts` ao mudar status do pedido + ao criar pedido.

## 🔐 Setup

### 1. Conta + API key
1. https://resend.com → cria conta.
2. Dashboard → API Keys → Create → copia.
3. Vercel env: `RESEND_API_KEY=re_xxx`.

### 2. Domain verify
1. Dashboard Resend → Domains → Add Domain → `lojadeprata925.com.br`.
2. Resend mostra 3 records DNS pra adicionar no registrador:
   - `MX` em `send.lojadeprata925.com.br` → `10 feedback-smtp.sa-east-1.amazonses.com`
   - `TXT` em `send.lojadeprata925.com.br` → `v=spf1 include:amazonses.com ~all`
   - `TXT` em `resend._domainkey.lojadeprata925.com.br` → `p=MIGfMA0GCSq...`
3. No Registro.br: adicionar os 3 records.
4. No painel Resend: click **"Verify DNS records"**. Deve virar **Verified ✅** em segundos (se DNS já propagou).

### 3. Sender configurado
Vercel env: `RESEND_FROM_EMAIL="Loja de Prata <pedidos@lojadeprata925.com.br>"`.

Resend não exige criar mailbox — qualquer remetente no domínio verified funciona.

## 📧 Emails enviados

| Quando | Template | Pra quem |
|---|---|---|
| Pedido criado | `pedidoCriadoClienteEmail` | Cliente |
| Pagamento confirmado | `pagamentoConfirmadoClienteEmail` | Cliente |
| Pagamento confirmado | `pagamentoRevendedoraEmail` | Revendedora |
| Pedido enviado | `pedidoEnviadoClienteEmail` | Cliente |
| Mensalidade vencendo | `mensalidadeAvisoEmail` (TODO) | Revendedora |

### Pedido criado (pré-pagamento)
- Resumo dos itens.
- Endereço de entrega.
- **Botão "Pagar agora"** (link Pagar.me hosted).
- **Sem botão WhatsApp** (foi removido por solicitação — desviava conversão).

Template em `lib/emailTemplates.ts` → `pedidoCriadoClienteEmail()`.

### Pagamento confirmado
- "🎉 Pagamento confirmado".
- Resumo do pedido.
- **Botão WhatsApp** pra falar com a revendedora.

Template: `pagamentoConfirmadoClienteEmail()`.

### Pedido enviado
- Notifica que saiu pra entrega.
- (Future: código de rastreio pra inserir).

Template: `pedidoEnviadoClienteEmail()`.

### Pagamento confirmado (revendedora)
- "Nova venda paga 💎".
- Resumo da comissão.
- Link pro painel `/vendas`.

Template: `pagamentoRevendedoraEmail()`.

## 🛠️ Helper `enviarEmail()`

```ts
// lib/email.ts
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM_EMAIL || 'Loja de Prata <onboarding@resend.dev>'

export async function enviarEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY ausente — pulando envio', { to, subject })
    return
  }
  try {
    const resend = new Resend(RESEND_API_KEY)
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (e) {
    console.error('[email] falha:', e)
    // Best-effort — não relança
  }
}
```

**Best-effort**: nunca lança erro. Falha de email NUNCA quebra o fluxo (criação de pedido, mudança de status, etc.).

## 🐛 Pegadinhas

### Resend free só envia pro email da conta
**Até verificar o domain**, Resend free só permite enviar pra o email cadastrado na conta. Após verify, manda pra qualquer destinatário.

Confirmar: `https://resend.com/domains` mostra **Verified**.

### Limite 100/dia free
Pra MVP suficiente. Quando passar (provavelmente >50 vendas/dia), upgrade pra plano pago.

### Sender no formato `Nome <email@domain>`
- ✅ `"Loja de Prata <pedidos@lojadeprata925.com.br>"`
- ❌ `"pedidos@lojadeprata925.com.br"` (sem display name, fica feio no inbox)

### Endereço inválido
Resend valida sintaxe do destinatário. Se inválido, retorna 422. Tratamos como falha silenciosa.

### Anti-spam
Como temos:
- ✅ DKIM
- ✅ SPF
- ✅ DMARC opcional (configurar futuro)
- ✅ Verified domain

A entregabilidade fica boa. Se mesmo assim cair no spam, monitorar via dashboard Resend → Logs → ver `delivered` vs `bounced`.

## 🧪 Testar envio

### Via console
```ts
import { enviarEmail } from '@/lib/email'
await enviarEmail({
  to: 'gabyfernandezweb@gmail.com',
  subject: 'Teste Resend',
  html: '<h1>Olá!</h1>'
})
```

### Via simulação de pedido
1. Cria pedido teste com checkout.
2. Acompanha no Resend dashboard → Logs.

## 📚 Links

- Resend dashboard: https://resend.com
- API docs: https://resend.com/docs/api-reference
- Templates docs: https://resend.com/docs/dashboard/emails/templates
