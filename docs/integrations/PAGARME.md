# Integração Pagar.me v5

Documentação completa do que a app faz com Pagar.me e como debugar.

## 📌 Modelo de conta

- **Conta principal Pagar.me**: pertence à Gabriela (CNPJ 11.356.333/0001-74). Recebe pagamentos e tem split habilitado pra distribuir para recipients.
- **Recipients (recebedores)**:
  - Cada **revendedora** cria o próprio recipient via `/perfil/recebedor`.
  - **Prata 15** tem recipient próprio (cadastrado manualmente no painel Pagar.me — ainda em processo).
  - **Gabriela (PF)** é a conta principal — recebe o *remainder* automaticamente.

## 💰 Modelo de split

Quando uma venda acontece:

| Beneficiário | % | Sobre | Tipo regra |
|---|---|---|---|
| Revendedora | 30% | subtotal | `flat` (se KYC ativo) |
| Prata 15 | 69.5% + frete inteiro | subtotal | `flat` (se recipient setado) |
| Gabriela (conta mãe) | 0.5% subtotal | — | remainder automático |

**Exemplo**: cliente paga R$100 subtotal + R$15 frete = R$115.
- Revendedora: R$30,00
- Prata 15: R$69,50 + R$15,00 = R$84,50
- Gabriela: R$0,50 (remainder)
- **Total**: R$115,00 ✓

Sem KYC ativo da revendedora, a comissão dela vai pro saldo interno (sistema legado de saques manuais). Quando ela ativa, próximas vendas começam a fazer split.

Sem `PAGARME_PRATA15_RECIPIENT_ID` setada, a parte de Prata 15 não tem split — fica com a conta mãe (Gabriela). Quando setar, próximas vendas começam a fazer split.

## 🔐 Autenticação

Basic Auth com sk como usuário, senha vazia:
```ts
const auth = 'Basic ' + Buffer.from(`${sk}:`).toString('base64')
```

`PAGARME_SECRET_KEY` em formato `sk_live_xxx` ou `sk_test_xxx`.

## 🛒 Fluxo de pagamento (PaymentLinks)

`POST /api/pedidos` → cria pedido em DB → chama `criarLinkPagarme()` → POST `https://api.pagar.me/core/v5/paymentlinks`.

### Body do request
```json
{
  "type": "order",
  "name": "Pedido PED-... - Prata 925",
  "order_code": "PED-20260609-XXXX",
  "payment_settings": {
    "accepted_payment_methods": ["credit_card", "pix"],
    "credit_card_settings": {
      "operation_type": "auth_and_capture",
      "installments": [
        { "number": 1, "total": 11500 },
        { "number": 2, "total": 11500 },
        { "number": 3, "total": 11500 }
      ]
    },
    "pix_settings": { "expires_in": 3600 }
  },
  "cart_settings": {
    "items": [{ "name": "Pedido PED-...", "amount": 11500, "default_quantity": 1 }]
  },
  "customer_settings": {
    "customer": { "name": "...", "email": "..." }
  },
  "split": {
    "enabled": true,
    "rules": [
      {
        "recipient_id": "re_xxx_revendedora",
        "amount": 3000,
        "type": "flat",
        "options": { "charge_processing_fee": false, "charge_remainder_fee": false, "liable": false }
      },
      {
        "recipient_id": "re_yyy_prata15",
        "amount": 8450,
        "type": "flat",
        "options": { "charge_processing_fee": false, "charge_remainder_fee": false, "liable": false }
      }
    ]
  },
  "flow_settings": {
    "success_url": "https://lojadeprata925.com.br/pedido/{id}/aguardando-pagamento"
  }
}
```

Pagar.me retorna `id` + `url`. Salvamos a URL em `pedidos.pagbank_link` (nome legado).

### Parcelamento sem juros
- Cada `installments[]` tem `total` igual ao valor do pedido. Pagar.me então NÃO cobra juros do cliente.
- Cobrança ao merchant: cada parcela tem fee bancária. Por isso o default é 3x (sweet spot).
- Configurável via `PAGARME_MAX_PARCELAS` (1-12).

## 👤 Recipients (criar recebedor)

`POST /api/revendedora/recebedor?submit=1` → `criarRecipientPagarme()` em `lib/pagarmeRecipient.ts` → POST `https://api.pagar.me/core/v5/recipients`.

### Body do request (PF / `individual`)
```json
{
  "description": "Recebedor Maria Silva",
  "register_information": {
    "type": "individual",
    "email": "maria@email.com",
    "document": "12345678901",
    "name": "Maria Silva",
    "phone_numbers": [
      { "ddd": "11", "number": "999999999", "type": "mobile" }
    ],
    "address": {
      "street": "Rua das Flores",
      "street_number": "123",
      "complementary": "Apto 45",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zip_code": "01234567"
    },
    "mother_name": "Maria das Dores Silva",
    "birthdate": "01/01/1990",
    "monthly_income": 500000,
    "professional_occupation": "Revendedora"
  },
  "default_bank_account": {
    "holder_name": "Maria Silva",
    "holder_type": "individual",
    "holder_document": "12345678901",
    "bank": "260",
    "branch_number": "0001",
    "account_number": "12345678",
    "account_check_digit": "9",
    "type": "checking"
  },
  "transfer_settings": {
    "transfer_enabled": true,
    "transfer_interval": "daily",
    "transfer_day": 0
  }
}
```

### Pegadinhas
1. **Não mande `name/email/document/type` no nível raiz** se for usar `register_information`. Pagar.me rejeita.
2. **`phone_numbers.ddd`** (não `area_code`).
3. **`birthdate` em DD/MM/AAAA** (não ISO).
4. **`monthly_income` em centavos** (5000 reais = 500000).
5. **`transfer_day: 0`** quando `transfer_interval: "daily"`.
6. **`holder_name` máx 30 chars**. Use `truncarHolderName()`.
7. **PJ exige `managing_partners`** com pelo menos 1 sócio (não implementado ainda).

### Resposta
```json
{
  "id": "re_xxx",
  "status": "registration"  // ou active / refused / etc
}
```

`status` possíveis:
- `registration` — Pagar.me pediu docs adicionais por email.
- `pending` — em análise.
- `active` — KYC OK, pode receber split.
- `refused` — recusado.
- `suspended`, `blocked` — situações de exceção.

Salvamos em `revendedoras.pagarme_recipient_id` + `pagarme_recipient_status` + `pagarme_recipient_data` (rascunho original).

## 🔔 Webhooks

Endpoint: `POST /api/webhook/pagarme`.

Eventos esperados (configurados em Pagar.me dashboard → Webhooks):
- `order.paid` — pedido pago → status pedido vira `pago`.
- `charge.paid` — fallback do anterior.
- `order.canceled` — TODO: implementar refund handler.
- `order.payment_failed` — TODO.
- `charge.refunded` — TODO.
- `charge.payment_failed` — TODO.
- `charge.chargedback` — TODO.
- `charge.partial_canceled` — TODO.
- `recipient.created` — atualiza `pagarme_recipient_status` por `pagarme_recipient_id` matching.
- `recipient.updated` — idem.

### Handler atual
```ts
// Pedido pago
if (tipo === 'order.paid' || tipo === 'charge.paid') {
  UPDATE pedidos SET status='pago' WHERE numero_pedido = data.code AND status != 'pago'
  → Trigger DB cria comissão
  → Dispara emails (Pagamento confirmado + Nova venda)
}

// Recipient atualizado
if (tipo.startsWith('recipient.')) {
  UPDATE revendedoras SET pagarme_recipient_status = data.status
    WHERE pagarme_recipient_id = data.id
}
```

### Segurança opcional (Basic Auth)
```env
PAGARME_WEBHOOK_USER=qualquer
PAGARME_WEBHOOK_PASS=algo_forte
```

Setar no Pagar.me dashboard a mesma credencial. Sem isso, qualquer um pode forjar webhook.

## 🐛 Debug

### Ver resposta crua ao criar recipient
```bash
curl -H "Authorization: Bearer prata925" \
  "https://lojadeprata925.com.br/api/admin/recebedor-test?slug=gabrielafernandez-5034" | jq
```

Retorna:
- `pagarme.status_http` — código HTTP.
- `pagarme.response.errors` — erros field-level.
- `pagarme.response.request` — eco do que Pagar.me recebeu (útil pra ver campo descartado).
- `payload_enviado` — body com docs mascarados.

### Logs Vercel
- `vercel logs` ou dashboard → Functions → Logs.
- Procurar `[pagarme]` ou `[pagarme recipient]`.

## 📚 Links Pagar.me

- Doc oficial: https://docs.pagar.me/reference/visao-geral
- Recipients v5: https://docs.pagar.me/reference/criar-um-recebedor-2
- PaymentLinks: https://docs.pagar.me/reference/criar-link
- Split: https://docs.pagar.me/docs/regras-de-split
- Dashboard prod: https://dash.pagar.me
