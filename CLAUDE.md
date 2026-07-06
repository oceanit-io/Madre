# Instruções para agentes de IA (Claude, Cursor, etc.)

Contexto e convenções deste codebase pra que agentes IA façam mudanças seguras e idiomáticas.

## 📌 Sobre o projeto

**lojadeprata925.com.br** — e-commerce multitenant onde cada **revendedora** tem sua própria loja (`/loja/[slug]`) personalizável, vendendo joias de um catálogo central sincronizado da Tray. Pagamento via Pagar.me (split automático entre revendedora, Prata 15 e conta mãe). Frete real via Correios PPN.

**Donos**:
- **Gabriela Fernandez** = dona da conta mãe Pagar.me. Recebe 0.5% automático por venda.
- **Prata 15** = supplier (entidade separada). Recebe 69.5% + frete.
- **Revendedoras** = cada uma é uma "tenant" — tem subdomínio próprio, recipient Pagar.me próprio. Recebem 30% por venda quando KYC ativo.

## 🏗️ Stack

Next.js 14 App Router + TypeScript + Supabase (Postgres + RLS + Auth + Storage) + Vercel.

## 🎯 Princípios de código

1. **TypeScript strict**. Não usar `any` se possível — usar `unknown` + narrowing.
2. **Server-first**. Lógica sensível (preço, split, frete, comissão) SEMPRE recalculada no server. Nunca confiar em valores vindos do client.
3. **Best-effort em emails e gateways**. Falha de email NUNCA quebra o pedido. Use try/catch sempre que chama serviço externo.
4. **Idempotente quando possível**. Webhooks devem ser idempotentes (mesma mensagem recebida 2x não duplica efeito).
5. **Comente o porquê, não o quê**. Código auto-explicativo pra o "o quê". Comentário pra constraint não-óbvia.
6. **Mensagens de commit em pt-BR**, descritivas, com co-author Claude.

## 🗺️ Onde está cada coisa

### Frontend
- **Storefront público**: `src/app/loja/[slug]/`. Renderiza vitrine + drawer + categorias.
- **Carrinho/checkout**: `src/app/carrinho/` e `src/app/checkout/`. Estado vive em `CarrinhoContext` (localStorage).
- **Painel revendedora**: `src/app/dashboard/`, `src/app/vendas/`, `src/app/saldo/`, `src/app/perfil/`, `src/app/configurar-loja/`. BottomNav fixo. Auth: Supabase.
- **Admin**: `src/app/admin/`. Auth **server-side multi-usuário** (cookie de sessão via `/admin/login`; PINs em `ADMIN_PIN`/`ADMIN_PIN_GABBY`/etc). Papel **`viewer`** (`ADMIN_PIN_VIEWER`) = somente leitura. Falta rate-limit no login (débito conhecido).

### Backend
- **API routes**: `src/app/api/`. Cada arquivo `route.ts` é um endpoint.
- **Auth-protegidas (revendedora)**: `src/app/api/revendedora/*` — usam `getRevendedoraFromRequest()`.
- **Auth-protegidas (admin)**: `src/app/api/admin/*` — usam `checkAdminAuth()` (cookie ou Bearer com `ADMIN_PIN_*` válido). O `prata925` antigo está **obsoleto**. Escritas (`POST/PATCH/DELETE`) são bloqueadas pro papel `viewer` no `middleware.ts`.
- **Públicas**: `/api/produtos`, `/api/frete`, `/api/loja/[slug]`, `/api/cep/[cep]`, `/api/pedidos` (POST).
- **Webhook**: `/api/webhook/pagarme`. Handler único pra todos eventos Pagar.me.

### Integrações
- `src/lib/pagarme.ts` — `criarLinkPagarme()` + split rules (pagamento dos PEDIDOS).
- `src/lib/pagarmeRecipient.ts` — POST `/v5/recipients` com KYC.
- `src/lib/infinitepay.ts` — link de cobrança do CADASTRO/mensalidade da revendedora (`order_nsu=cad_<id>` → webhook ativa a loja). Flag em `infinitepayConfig.ts`.
- `src/lib/pagbank.ts` — fallback de pagamento (no-op sem `PAGBANK_TOKEN`).
- `src/lib/correios.ts` — auth PPN + cotação PAC/SEDEX + diagnóstico.
- `src/lib/traySync.ts` — sync de produtos do `pratade15reais.com.br/web_api`.
- `src/lib/frete.ts` — orquestrador frete (Correios + fallback tabela fixa).

### DB
- `supabase/*.sql` — migrations. Aplicam-se manualmente via **Supabase Management API** (`SUPABASE_ACCESS_TOKEN`). Não há ferramenta de migração automática — cada SQL é uma alteração aplicada uma vez.
- Tabelas principais:
  - `revendedoras` — uma por loja. Status: pendente/ativa/suspensa.
  - `produtos` — sincronizado da Tray. PK = `sku` (id da Tray).
  - `pedidos` — checkout guest. PK uuid, `numero_pedido` único.
  - `comissoes` — gerada por trigger ao mudar status do pedido pra `pago`.
  - `saques`, `mensalidades`, `notificacoes`, `sync_estado`.

## ⚠️ Pitfalls comuns

### Pagamento e split
- **Pagar.me v5 é zoado**: tem dois jeitos de criar recebedor (simples vs com `register_information`). O nosso usa `register_information` (KYC completo, requirement marketplace).
- **Quando usa `register_information`, NÃO pode mandar `name/email/document/type` no nível raiz** — Pagar.me rejeita com "field cannot be populated when register_information is populated".
- **`phone_numbers` usa `ddd` (não `area_code`)**. Doc Pagar.me confunde os 2 nomes.
- **`transfer_day: 0` pra `transfer_interval: 'daily'`** (não 1).
- **`birthdate` em formato DD/MM/AAAA** (não ISO).
- **`holder_name` da conta bancária: máx 30 chars**. Use `truncarHolderName()`.
- **Split é por SUBTOTAL (sem frete)**, exceto Prata 15 que recebe % subtotal + frete inteiro.
- **Money em centavos**. Todas amounts Pagar.me são integers de centavos.

### Correios PPN
- **`/preco/v1/nacional/{servico}` e `/prazo/v1/nacional/{servico}` usam GET com query params**. POST dá 405. Doc confunde com endpoint bulk.
- **DR é número (ex `72`), não sigla (ex `SE`)**. O auth retorna o número correto.
- **Cartão de postagem é tipicamente 10 dígitos** com zeros à esquerda. Confirme antes de cadastrar.
- **Token JWT vale ~24h, cacheado em memória do processo**. Cold start de serverless re-autentica.
- **Códigos PAC/SEDEX são DO CONTRATO** (ex `03298`/`03220`), não os de balcão (`04510`/`04014`).

### Tray
- **Tray endpoint público `/web_api/products`** funciona sem auth, mas `/categories` exige token. Por isso a **subcategoria é derivada do SLUG** do produto (`correntes/com-pingente/...`).
- **`category_id` não é confiável** pra hierarquia. Diferentes paths têm mesmo `category_id` na conta Prata 15.

### Frete grátis
- Threshold em `FRETE_GRATIS_MINIMO = 250` no lib/frete.ts.
- Quando frete grátis, mostra PAC + SEDEX em R$0 (mas com prazos típicos diferentes).

### Mobile responsivo
- `.revendedora-app` tem `max-width: 430px` no mobile. Desktop ≥880px alarga pra 780px com border.
- BottomNav usa **GPU layer trick** (`translateZ(0)` + `z-index:1000`) pra ficar fixo em iOS Safari. Não mexer sem testar em iPhone real.
- `env(safe-area-inset-bottom)` é importante pra notch/home indicator.

### Storefront tema
- Cores, fontes, fundos, banners e cor do texto do hero são configuráveis. Lista válida em `src/lib/temasLoja.ts`.
- **Validação NUNCA fica só client**. PATCH `/api/revendedora/loja` valida server-side contra as listas.

## 🛠️ Convenções de mudança

### Criando nova feature
1. Se mexe em DB, **escreva SQL em `supabase/*.sql`** + aplique via Management API antes de fazer deploy do código.
2. Se mexe em env, **documente em `docs/ENV_VARS.md`** + descreva no commit.
3. Se mexe em integração externa, **adicione endpoint de diagnóstico admin** (ex: `/api/admin/correios-diag`) pra debug rápido.
4. **Mobile responsive sempre** — teste em DevTools 320px de largura.

### Endpoints admin
- Padrão: `GET /api/admin/<coisa>` com `Authorization: Bearer <ADMIN_PIN válido>` (ou cookie de sessão). O `prata925` está obsoleto.
- Retornam JSON estruturado pra debug — não pra UI.
- Não expõem dados sensíveis em texto plain (mascarar CPF, conta bancária, tokens).

### Webhook handlers
- **Sempre retornar 200** mesmo em erro (logar e seguir). Pagar.me reenvia em loop se receber não-200.
- **Idempotência**: usar `.update()` com `.neq('status', 'pago')` pra não disparar email 2x.

### Commits
- Mensagem em pt-BR (linha 1 com tipo: `feat(escopo):` / `fix(escopo):` / etc).
- Body explicando POR QUÊ e CONSIDERATIONS.
- Co-author Claude no fim: `Co-Authored-By: Claude <noreply@anthropic.com>` (modelo varia).

## 🔍 Onde encontrar info de produção

- **Conta Pagar.me**: CNPJ Gabriela 11.356.333/0001-74, acc_ev9QVVVt74tzQzAV.
- **DR Correios**: 72 (Sergipe).
- **Vercel project**: `revendedoraspratade15reais`. Branch `main`.
- **Supabase project**: `ipovxwzzqjjywratrbjx` em São Paulo.
- **Resend domain**: `lojadeprata925.com.br` (verified).
- **Tray source**: `https://www.pratade15reais.com.br/web_api`.

## 🧪 Como testar mudanças

```bash
# Type check
npx tsc --noEmit

# Build (catches mais coisas que tsc)
npx next build

# Dev local
npm run dev
```

Não há suite de testes automatizados ainda. Testes manuais via:
- Comprar uma peça real chica (R$5-30) em incognito.
- Verificar pedido em /admin/pedidos.
- Endpoints diag: `/api/admin/correios-diag-v2?cep=01310100`, `/api/admin/recebedor-test?slug=X`.

## 📚 Veja também

- [README](./README.md) — visão geral.
- [docs/ARCHITECTURE](./docs/ARCHITECTURE.md) — desenho do sistema.
- [docs/RUNBOOK](./docs/RUNBOOK.md) — operações comuns.
- [docs/integrations/](./docs/integrations/) — cada integração em detalhes.
