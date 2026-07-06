# Arquitetura

Como o sistema se encaixa.

## 🎭 Atores

- **Cliente final** — pessoa que compra na loja de alguma revendedora.
- **Revendedora** — operadora de uma loja (tenant). Cadastra-se em `/auth/register`, paga mensalidade, personaliza vitrine, ganha comissão.
- **Admin (Gabriela)** — gerencia revendedoras, pedidos, sync de catálogo, ativações. Painel em `/admin/*` protegido por PIN.
- **Prata 15** — supplier externo. Catálogo é puxado da loja Tray deles (`pratade15reais.com.br`). Recebe % de cada venda via split.

## 🗺️ Fluxo principal — do clique à comissão

```
┌──────────┐
│ Cliente  │   1. Abre loja /loja/{slug}
└────┬─────┘
     │
     │   GET /api/loja/{slug} (dados da revendedora)
     │   GET /api/produtos (catálogo + árvore categorias)
     │
     ▼
┌──────────────┐
│ Storefront   │   Vitrine, filtro, busca
│ /loja/{slug} │
└────┬─────────┘
     │   Add ao carrinho (localStorage via CarrinhoContext)
     ▼
┌──────────┐
│ Carrinho │   Seleção tipo Shopee (deselecionados)
└────┬─────┘
     │   POST /api/frete (com CEP + UF + subtotal + qntItens)
     │     → Correios PPN ou fallback tabela
     │   Cliente escolhe PAC ou SEDEX
     ▼
┌────────────┐
│  Checkout  │   Form com validação BR (CPF, CEP, telefone)
└────┬───────┘
     │   POST /api/pedidos
     │     1. Recalcula tudo no server (subtotal, frete, total)
     │     2. Insere pedido (status: aguardando_pagamento)
     │     3. Resolve recipient da revendedora pra split
     │     4. POST Pagar.me /paymentlinks com split rules
     │     5. Salva pagbank_link no pedido
     │     6. Dispara email "Pedido recebido" (Resend)
     │     7. Notifica revendedora interna
     ▼
┌──────────────────────────┐
│ /pedido/{id}/aguardando- │   Link Pagar.me clicável
│  pagamento               │
└────┬─────────────────────┘
     │   Cliente vai pro Pagar.me
     │   Paga com cartão (3x sem juros) ou PIX
     ▼
┌─────────┐
│Pagar.me │   Processa pagamento
└────┬────┘
     │
     │  Webhook POST → /api/webhook/pagarme
     │    type: 'order.paid' | 'charge.paid'
     │    data.code = numero_pedido
     ▼
┌──────────────────────┐
│ Webhook handler      │
│ /api/webhook/pagarme │
└────┬─────────────────┘
     │   UPDATE pedidos SET status='pago'
     │     (com .neq('status', 'pago') pra idempotência)
     │
     │   Trigger DB cria linha em `comissoes`
     │     (em análise 20 dias → liberada → saldo_disponivel)
     │
     │   Dispara emails:
     │     - "Pagamento confirmado" ao cliente
     │     - "Nova venda paga" à revendedora
     │
     │   Pagar.me divide o $ entre recipients:
     │     30% → revendedora (recipient dela)
     │     69.5% subtotal + 100% frete → Prata 15
     │     0.5% subtotal → conta mãe (Gabriela) [auto remainder]
     ▼
┌────────────────────┐
│ Painel revendedora │   Venda aparece em /vendas
│                    │   Comissão entra em /saldo
└────────────────────┘
```

## 🧩 Componentes

### Frontend (Next.js App Router)

**Storefront público** (`/loja/[slug]`, `/loja/[slug]/produto/[id]`, `/carrinho`, `/checkout`, `/pedido/[id]/aguardando-pagamento`)
- Sem auth.
- Renderiza com base no slug da revendedora (multitenant).
- Tema (cor, fonte, fundo, banner, hero text color, cinta) vem do `/api/loja/{slug}`.

**Painel da revendedora** (`/dashboard`, `/vendas`, `/saldo`, `/perfil/*`, `/configurar-loja`, `/minha-loja`)
- Auth: Supabase. Sem sessão → redirect pra `/auth/login`.
- `BottomNav` fixo em mobile com 5 tabs.
- `/configurar-loja` é o editor visual da loja.
- `/perfil/recebedor` é o cadastro de recipient Pagar.me (multi-step form).

**Admin** (`/admin/*`)
- Auth: PIN (`ADMIN_PIN` no env). Verificado no client + server.
- **Ressalva**: o PIN está no bundle do client → débito técnico conhecido. Mover server-side ao consolidar segurança.

### Backend (API routes)

#### Públicas
- `GET /api/loja/{slug}` — dados pra renderizar a vitrine.
- `GET /api/produtos` — listagem + busca + árvore categorias com subcategorias.
- `GET /api/produtos/{id}` — detalhe do produto.
- `GET /api/produtos/{id}/variacoes` — variações Tray (tamanho/cor).
- `GET /api/produtos/{id}/referencia` — referência via scraping do HTML da Tray.
- `POST /api/frete` — cotação. Body: `{uf, cep, subtotal, qntItens}`. Retorna `{regiao, opcoes[]}`.
- `POST /api/pedidos` — criar pedido. Body com cliente+endereco+itens+frete_servico.
- `GET /api/cep/{cep}` — proxy ViaCEP.

#### Auth-protegidas (revendedora)
Usam `getRevendedoraFromRequest(request)` que valida Bearer token Supabase.

- `GET /api/revendedora/financeiro` — totais + comissões.
- `GET /api/revendedora/pedidos` — pedidos da loja.
- `GET /api/revendedora/recebedor` — rascunho atual + status KYC.
- `POST /api/revendedora/recebedor` — salva rascunho (sem ?submit) ou submete ao Pagar.me (?submit=1).
- `PATCH /api/revendedora/loja` — atualiza personalização.

#### Auth-protegidas (admin)
Usam `checkAdminAuth(request)` com `Authorization: Bearer prata925`.

- `GET /api/admin/correios-diag` — status das envs.
- `GET /api/admin/correios-diag-v2?cep=...` — passo-a-passo auth + cotação.
- `GET /api/admin/recebedor-test?slug=...` — dispara cadastro Pagar.me com rascunho.
- `GET /api/admin/pedidos` — listagem com filtros.
- `PATCH /api/admin/pedidos/{id}` — muda status (dispara emails).

#### Webhook
- `POST /api/webhook/pagarme` — handler único.
  - `order.paid` / `charge.paid` → marca pedido pago.
  - `recipient.*` → atualiza status KYC do recipient.
  - Outros → ignora (200 OK).

#### Cron
- `GET /api/cron/tray-sync` — chamado pelo Vercel Cron. Sync diário 03:00.

### DB (Supabase)

- **Postgres** com RLS habilitado em tabelas sensíveis.
- **Migrations**: arquivos SQL em `supabase/`, aplicados manualmente via Management API.
- **Tabelas principais**:
  - `revendedoras` — uma por loja. Status pendente/ativa/suspensa.
  - `produtos` — sincronizado da Tray.
  - `pedidos` — checkout guest (sem user_id).
  - `comissoes` — gerada por trigger ao marcar pedido como pago.
  - `saques` — solicitações de saque.
  - `mensalidades` — controle de pagamento mensal das revendedoras.
  - `notificacoes` — feed de notificações da revendedora (nova venda, etc).
  - `sync_estado` — última execução do sync Tray.

Ver [DATABASE.md](./DATABASE.md) pra detalhes.

### Integrações externas

| Sistema | Pra quê | Lib |
|---|---|---|
| **Pagar.me** | Pagamento (cartão+PIX) + split + recipient | `lib/pagarme.ts`, `lib/pagarmeRecipient.ts` |
| **Correios PPN** | Frete real PAC + SEDEX | `lib/correios.ts` |
| **Tray** | Catálogo (público, scraping) | `lib/traySync.ts` |
| **Resend** | Emails transacionais | `lib/email.ts`, `lib/emailTemplates.ts` |
| **ViaCEP** | Lookup de endereço por CEP | `/api/cep/[cep]` |
| **Supabase** | DB + Auth + Storage | `lib/supabase.ts`, `lib/supabaseAdmin.ts` |

Ver [docs/integrations/](./integrations/) pra cada uma.

## 🔐 Modelo de autenticação

### Cliente final (storefront público)
- Sem auth. Sessão = só `CarrinhoContext` em localStorage.

### Revendedora (painel)
- **Auth**: Supabase Auth (email + senha).
- **Cadastro**: `/auth/register` cria user Supabase + linha em `revendedoras` (status=pendente).
- **Ativação**: admin faz via `/admin/ativar` (após confirmação de pagamento da mensalidade R$39,99).
- **Sessão**: persiste em cookies Supabase. Token via `Authorization: Bearer` em chamadas server-side.

### Admin
- **Auth**: PIN simples (`ADMIN_PIN` no env). Modal pede o PIN, salva em sessionStorage.
- **Segurança**: PIN está no bundle do client (débito técnico). Endpoints validam `Bearer prata925` server-side, então o PIN não pode ser bypassado pra ações sensíveis — mas pode ser descoberto via inspecionar bundle JS.

## 🛣️ Multitenancy

Cada revendedora é um tenant. A separação acontece por:

- **`subdominio`** (text único) — usado em URL `/loja/{subdominio}`.
- **`user_id`** (uuid) — linka à conta Supabase Auth da revendedora.
- **`slug_revendedora`** em `pedidos` e `comissoes` — derivado do subdomínio.

Não há subdomínio DNS por revendedora — todas estão em `lojadeprata925.com.br/loja/{slug}`.

## 🔄 Sync de catálogo

- Fonte: `https://www.pratade15reais.com.br/web_api/products` (público).
- Frequência: cron diário 03:00 (Vercel Hobby permite 1 cron por dia).
- Trigger manual: `/admin/destaques` → botão "Sincronizar Tray".
- O sync atualiza nomes/preços/fotos/estoque/categoria/subcategoria. **Preserva `destaque`** (curado manual).
- Categoria pai e subcategoria são derivadas do **slug** Tray (ex: `correntes/com-pingente/...` → pai="Correntes", sub="Com Pingente").

## 💸 Modelo financeiro

### Comissão por venda
- Default 30% sobre subtotal (sem frete).
- Salva em `comissoes` ao status do pedido virar `pago`.
- Status da comissão: `processando` (20 dias) → `liberada` → `paga` (após saque).
- Saldos da revendedora: `saldo_processando` + `saldo_disponivel`.

### Split Pagar.me (quando todos recipients ativos)
- 30% → recipient da revendedora.
- 69.5% subtotal + frete inteiro → recipient Prata 15.
- 0.5% subtotal → conta mãe Gabriela (remainder automático).

### Saque
- Revendedora solicita em `/saldo`. Cria linha em `saques` com status `solicitado`.
- Admin aprova manualmente → status `processando` → `pago`.
- Saldo é debitado quando saque vira `pago`.

## 🚨 Falhas conhecidas / débitos técnicos

1. **PIN admin no bundle client** — mover server-side.
2. **Sem testes automatizados** — manual via produção.
3. **Sem suite E2E** — incognito + cards reais.
4. **Webhook refund handler** não implementado — refund manual no Pagar.me não atualiza DB.
5. **Páginas legais ausentes** (Termos, Privacidade, LGPD, Troca).
6. **Footer sem CNPJ** — obrigatório por CDC.
7. **Supabase Management API token foi exposto em chat antes** — rotar.
8. **Saque é manual** — sem integração bancária real.
9. **PJ no cadastro de recebedor não suporta `managing_partners`** — bloqueia cadastro PJ via nosso form.

Ver [ROADMAP](#) (a criar) pra priorização.
