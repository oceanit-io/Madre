# Variáveis de ambiente

Referência **completa e atual** (jun/2026). Gerada a partir do código (`grep process.env`).
No Vercel, marque **Production + Preview + Development** salvo quando indicado.

Legenda: 🔒 = secreta (nunca expor / nunca `NEXT_PUBLIC_`) · 🌍 = pública (vai pro bundle do client).

---

## 🌐 App geral

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `APP_URL` | sim | `https://lojadeprata925.com.br` | Base URL pra `redirect_url`/`webhook_url` (Pagar.me, InfinitePay). |
| `NEXT_PUBLIC_APP_URL` 🌍 | recomendado | igual a `APP_URL` | Domínio canônico usado em e-mails e links compartilháveis. |
| `NEXT_PUBLIC_COMISSAO_PERCENT` 🌍 | não | `30` (default) | % de comissão exibido na UI. |
| `NEXT_PUBLIC_MENSALIDADE` 🌍 | não | `39.90` (default) | Valor da mensalidade exibido na UI. |

---

## 🏷️ Marca (white-label)

Sem estas, cai no default (Loja de Prata 925). Centralizadas em `src/lib/brand.ts`.
Guia completa pra abrir uma marca nova: [WHITE_LABEL.md](./WHITE_LABEL.md).

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `NEXT_PUBLIC_BRAND_NOME` 🌍 | não | `Lunara Joias` | Nome comercial (títulos, e-mails, rodapés). |
| `NEXT_PUBLIC_BRAND_LOGO_PREFIXO` 🌍 | não | `Lunara` | 1ª parte do logo textual. |
| `NEXT_PUBLIC_BRAND_LOGO_DESTAQUE` 🌍 | não | `Joias` | 2ª parte (colorida). Vazio = sem split. |
| `NEXT_PUBLIC_BRAND_FORNECEDOR` 🌍 | não | `Lunara Atacado` | Supplier do catálogo (split + selo). |
| `NEXT_PUBLIC_BRAND_FORNECEDOR_LOGO` 🌍 | não | `/branding/logo-lunara.png` | Logo do fornecedor (asset local). |
| `NEXT_PUBLIC_BRAND_OPERADORA` 🌍 | não | `Ocean IT` | Operadora legal (rodapé/privacidade). |
| `NEXT_PUBLIC_BRAND_DOMINIO` 🌍 | não | `lunarajoias.com.br` | Domínio sem protocolo. |
| `NEXT_PUBLIC_BRAND_COR` 🌍 | não | `#7C5CFF` | Cor de destaque (logo/acentos). |
| `NEXT_PUBLIC_BRAND_CATALOGO` 🌍 | não | `manual` | `tray` (sync auto) ou `manual` (CRUD admin). |

---

## 🔐 Supabase

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` 🌍 | sim | `https://xxx.supabase.co` | URL do projeto. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` 🌍 | sim | `eyJhbG…` | Anon key (auth client-side). |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | sim | `eyJhbG…` | Service role pras APIs server (bypassa RLS). **NUNCA expor.** |
| `SUPABASE_ACCESS_TOKEN` 🔒 | só dev/ops | `sbp_…` | Management API (aplicar SQL). Não é usado em runtime. |

---

## 🛡️ Admin & cron

Auth admin é **multi-usuário** (jun/2026): cada pessoa tem um PIN; o cookie guarda o identificador, não o PIN.

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `ADMIN_PIN` 🔒 | sim | PIN longo aleatório | PIN "master". Usado em Bearer/curl e como fallback. |
| `ADMIN_PIN_GABBY` 🔒 | opcional | PIN | PIN da Gabby (identifica quem no audit log). |
| `ADMIN_PIN_ANDERSON` 🔒 | opcional | PIN | PIN do Anderson. |
| `ADMIN_PIN_ESCRITORIO` 🔒 | opcional | PIN | PIN do escritório. |
| `ADMIN_PIN_VIEWER` 🔒 | opcional | PIN | Acesso **somente leitura** (vê métricas, não altera nada). |
| `ADMIN_EMAIL` / `ADMIN_EMAILS` | recomendado | `gaby@…` (vírgula separa vários) | Pra onde vão avisos do admin (pagamento sem match etc.). |
| `CRON_SECRET` 🔒 | recomendado | secret aleatório | Bearer pros crons (além do header `x-vercel-cron`). |

⚠️ Use **PINs longos e aleatórios** (12+ chars). O login admin **não tem rate-limit** ainda — PIN curto é brute-forceável. O `prata925` antigo está **obsoleto**.

---

## 💳 Pagar.me — pagamento dos PEDIDOS (split 3-way)

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `PAGARME_SECRET_KEY` 🔒 | sim (p/ Pagar.me) | `sk_live_…` / `sk_test_…` | Chave secreta. Sem ela, cai pro PagBank. |
| `PAGARME_BASE_URL` | não | `https://api.pagar.me/core/v5` (default) | Trocar p/ sandbox em dev. |
| `PAGARME_MAX_PARCELAS` | recomendado | `3` | Máx. de parcelas sem juros. |
| `PAGARME_PIX_EXPIRA_S` | não | `3600` (default) | TTL do PIX em segundos. |
| `PAGARME_MAIN_RECIPIENT_ID` | recomendado | `re_…` | Recipient da conta mãe (recebe 0,5% + sobra do split). |
| `PAGARME_PRATA15_RECIPIENT_ID` | recomendado | `re_…` | Recipient da Prata 15 (supplier). |
| `PAGARME_REVENDEDORA_PERCENT` | não | `0.30` (default) | % da revendedora sobre o subtotal. |
| `PAGARME_PRATA15_PERCENT` | não | `0.695` (default) | % da Prata 15 sobre o subtotal. |
| `PAGARME_WEBHOOK_USER` 🔒 | recomendado | string | Basic Auth no webhook `/api/webhook/pagarme`. |
| `PAGARME_WEBHOOK_PASS` 🔒 | recomendado | string | Idem. **Setar pra evitar webhook forjado.** |

Detalhes: [integrations/PAGARME.md](./integrations/PAGARME.md).

---

## 💎 InfinitePay — pagamento do CADASTRO/MENSALIDADE da revendedora

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `INFINITEPAY_HANDLE` | recomendado | `oceanit` (default) | A InfiniteTag (handle) da conta que recebe. |
| `INFINITEPAY_WEBHOOK_TOKEN` 🔒 | recomendado | string | Token compartilhado no webhook `/api/webhook/infinitepay`. |

A ativação automática usa link **dinâmico** (`order_nsu=cad_<id>`) → o webhook ativa a loja sozinho. Veja `src/lib/infinitepayConfig.ts` (`INFINITEPAY_LINK_DINAMICO`).

---

## 🟧 PagBank — fallback de pagamento (inativo por padrão)

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `PAGBANK_TOKEN` 🔒 | não | token | **Sem ela, PagBank é no-op.** Setar habilita o fallback. |
| `PAGBANK_BASE_URL` | não | base URL da API | Endpoint PagBank. |
| `PAGBANK_WEBHOOK_TOKEN` 🔒 | não | string | Token no webhook `/api/webhook/pagbank`. |

---

## 📮 Correios PPN — frete

Todas obrigatórias pra frete real. Sem elas, cai pra tabela fixa por região.

| Variable | Exemplo | Pra quê |
|---|---|---|
| `CORREIOS_USUARIO` 🔒 | usuário API | Auth Basic. |
| `CORREIOS_SENHA` 🔒 | senha API | Auth Basic. |
| `CORREIOS_CONTRATO` | `9912265452` | Nº do contrato (10 dígitos). |
| `CORREIOS_CARTAO_POSTAGEM` | `0066885507` | Cartão de postagem (10 dígitos, com zeros à esquerda). |
| `CORREIOS_DR` | `72` | Código **numérico** da DR (não é sigla). |
| `CORREIOS_CEP_ORIGEM` | `49000000` | CEP origem (8 dígitos). |
| `CORREIOS_PAC_CODIGO` | `03298` | Código PAC **do contrato** (não o de balcão `04510`). |
| `CORREIOS_SEDEX_CODIGO` | `03220` | Código SEDEX **do contrato** (não `04014`). |

Detalhes: [integrations/CORREIOS.md](./integrations/CORREIOS.md).

---

## 📧 Resend — e-mails

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `RESEND_API_KEY` 🔒 | sim | `re_…` | API key. Sem ela, e-mails são silenciosos (logam e seguem). |
| `EMAIL_FROM` | sim | `Loja de Prata 925 <pedidos@lojadeprata925.com.br>` | Remetente. ⚠️ O **endereço** tem que ser do **domínio verificado** no Resend, senão só entrega pra conta dona. O nome de exibição é forçado a `brand.nome` (white-label) no código. |
| `MONITOR_EMAIL_BCC` | não | `gaby@gmail.com` (default setado) | BCC de monitoramento em **todo** e-mail. `''` (vazio) desliga. |

⚠️ A variável correta é **`EMAIL_FROM`** (não `RESEND_FROM_EMAIL`). **E-mails de auth (reset de senha)** são enviados pelo **Supabase**, não pelo Resend — configure o SMTP custom no Supabase (Auth → SMTP) apontando pro Resend, senão o reset não chega (rate-limit do SMTP default).

---

## 🛒 Tray — catálogo

| Variable | Obrigatória? | Exemplo | Pra quê |
|---|---|---|---|
| `TRAY_BASE_URL` | não | `https://www.pratade15reais.com.br/web_api` (default) | web_api público. |
| `TRAY_SYNC_ENABLED` | não | — | O sync diário **roda por padrão**. Setar **`0`** é o kill-switch que **desliga** (best-sellers/destaques param de atualizar). |

Detalhes: [integrations/TRAY.md](./integrations/TRAY.md).

---

## 🧾 SG / ERP externo (opcional)

| Variable | Obrigatória? | Pra quê |
|---|---|---|
| `SG_USUARIO` 🔒 | só se usar | Credencial do ERP (endpoint `/api/sg/autenticar`). |
| `SG_SENHA` 🔒 | só se usar | Idem. |

---

## 🚫 Depreciadas (apagar do Vercel se existirem)

| Variable | Status |
|---|---|
| `RESEND_FROM_EMAIL` | **Trocada por `EMAIL_FROM`.** O código não lê mais essa. |
| `PAGARME_PLATFORM_RECIPIENT_ID` / `PAGARME_PLATFORM_PERCENT` | Modelo antigo. Use `PAGARME_PRATA15_*`. |

---

## 🔍 Verificar envs em produção

A auth admin agora é por **cookie de sessão** (login no painel) ou Bearer com um `ADMIN_PIN_*` válido. Os exemplos de curl com `prata925` **não funcionam mais**. Use o painel admin (`/admin`) logado, ou um PIN real:

```bash
curl -H "Authorization: Bearer <ADMIN_PIN_real>" \
  "https://lojadeprata925.com.br/api/admin/correios-diag-v2?cep=01310100"
```
