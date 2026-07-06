# Testes E2E — Loja de Prata 925

Suite Playwright para cobertura funcional, de segurança e responsividade da plataforma `lojadeprata925.com.br`.

## Pré-requisitos

```bash
npm install
npx playwright install chromium
```

Crie um arquivo `.env.test` na raiz do projeto (nunca commitar):

```env
BASE_URL=https://lojadeprata925.com.br
TEST_EMAIL=sua-revendedora-de-teste@email.com
TEST_PASSWORD=senha-da-conta
TEST_STORE_SLUG=slug-da-loja-de-teste
ADMIN_TOKEN=pin-admin-real-do-vercel
ALLOW_MUTATING_TESTS=false
```

> **ADMIN_TOKEN**: o valor documentado em CLAUDE.md (`prata925`) é placeholder. O PIN real está na variável de ambiente `ADMIN_PIN` no painel Vercel do projeto.

## Comandos

```bash
# Suite completa (headless)
npm run test:e2e

# Com browser visível
npm run test:e2e:headed

# UI interativa do Playwright
npm run test:e2e:ui

# Apenas smoke tests (público, sem auth)
npm run test:e2e:smoke

# Apenas testes de segurança admin
npm run test:e2e:security

# Abrir relatório HTML do último run
npm run test:e2e:report
```

## Estrutura dos arquivos

```
tests/e2e/
├── helpers/
│   ├── env.ts          # Variáveis de ambiente com guards (requireAuth, requireSlug...)
│   └── test-data.ts    # Dados fictícios reutilizáveis (CPF válido, endereço, etc.)
│
├── auth.setup.ts       # Roda antes de tudo: faz login e salva storageState
│
├── smoke.spec.ts            # Rotas públicas: status HTTP < 500, sem erros críticos
├── auth.spec.ts             # Login/logout, proteção de rotas autenticadas
├── registration.spec.ts     # Cadastro de revendedora: formulário 2 etapas (sem criar conta real)
├── dashboard.spec.ts        # Painel da revendedora (requer auth + loja personalizada)
├── vendas.spec.ts           # Painel de vendas: métricas, filtros, expandir pedido (requer auth)
├── configurar-loja.spec.ts  # Personalização da loja: campos, cor, URL (requer auth)
├── storefront.spec.ts       # Vitrine pública /loja/[slug] (requer TEST_STORE_SLUG)
├── produto-variacao.spec.ts # Produto com variação: "Ver opções →" → página de detalhe → carrinho
├── cart.spec.ts             # Carrinho: adicionar sem variação, remover, quantidade, frete
├── frete-real.spec.ts       # Calculadora de frete: CEP real → opções PAC/SEDEX com prazo e valor
├── checkout.spec.ts         # Formulário básico até ANTES do pagamento
├── checkout-completo.spec.ts # Fluxo completo: vitrine → carrinho + frete → checkout preenchido
├── admin-security.spec.ts   # Endpoints /api/admin/* sem token → 401/403
└── responsive.spec.ts       # Mobile: overflow, tappable targets, BottomNav fixo
```

## Restrições de segurança (permanentes)

- `ALLOW_MUTATING_TESTS=false` por padrão — apenas leitura em produção.
- **Nunca** clica em botão de pagamento real (PIX/cartão/boleto).
- **Nunca** marca saques como pagos via API.
- **Nunca** aciona `POST /api/admin/ativar-revendedora`, `POST /api/admin/saques/[id]`, `POST /api/admin/simular-pedido` em produção.
- Traces/screenshots/videos NÃO são commitados (estão no `.gitignore`).
- Credenciais vivem apenas em `.env.test` (também no `.gitignore`).

## Seletores utilizados (sem data-testid no codebase)

Os testes usam atributos existentes no código:

| Seletor | Elemento |
|---|---|
| `[data-tour="saldo"]` | Card de saldo no dashboard |
| `[data-tour="resumo"]` | Grid de métricas do mês |
| `[data-tour="link-loja"]` | Card com link da vitrine |
| `[data-tour="comissoes"]` | Seção de últimas comissões |
| `[data-tour="bottom-nav"] nav` | BottomNav fixo (o `<nav>` interno, não o wrapper zero-height) |
| `.lj-hdr`, `.lj-hero`, `.lj-card`, `.lj-card-btn` | Elementos da vitrine pública |
| `button[aria-label="Abrir menu"]` | Botão do drawer de categorias |
| `[role="dialog"][aria-label="Menu da loja"]` | Drawer aberto |

## Comportamentos conhecidos que afetam os testes

### Dashboard redireciona para /configurar-loja
Contas com status `ativa` mas sem personalização (sem `nome_loja`, `foto_url`, etc.) são redirecionadas. Os testes do dashboard detectam isso e pulam com `test.skip()` em vez de falhar.

### BottomNav tem wrapper zero-height
`[data-tour="bottom-nav"]` é um `<div>` wrapper de `position: fixed` — sua altura é 0. Por isso os testes verificam `[data-tour="bottom-nav"] nav` (o `<nav>` real) com `toBeAttached()` em vez de `toBeVisible()`.

### ADMIN_TOKEN ≠ valor do CLAUDE.md
O CLAUDE.md documenta `prata925` como exemplo, mas o PIN real é diferente. Testes de admin leitura logam um aviso e continuam quando recebem 401/403 inesperado.

### 18 testes pulados por padrão
`storefront.spec.ts`, `cart.spec.ts` e parte de `responsive.spec.ts` pulam quando `TEST_STORE_SLUG=slug-da-loja` (placeholder). Configure com o slug real para ativar.

## Cobertura atual (2026-06-25)

| Área | Coberta? | Arquivo(s) |
|---|---|---|
| Vitrine pública | ✅ | `smoke.spec.ts`, `storefront.spec.ts` |
| Produto com variação | ✅ | `produto-variacao.spec.ts` |
| Calculadora de frete | ✅ | `frete-real.spec.ts` |
| Cadastro de revendedora | ✅ | `registration.spec.ts` |
| Checkout (sem pagamento) | ✅ | `checkout-completo.spec.ts` |
| Dashboard de vendas | ✅ | `vendas.spec.ts` |
| Configurar loja | ✅ | `configurar-loja.spec.ts` |
| Segurança admin | ✅ | `admin-security.spec.ts` |
| Checkout com pagamento real | ❌ | Precisa de ambiente staging + Pagar.me sandbox |
| Saque de comissão (fluxo) | ❌ | `ALLOW_MUTATING_TESTS` bloquearia em prod |
| KYC / criação de recebedor | ❌ | Precisaria de dados bancários fictícios aceitos pelo Pagar.me sandbox |

## Planos futuros

- **Checkout com pagamento sandbox:** criar `.env.staging` com `PAGARME_API_KEY=ak_test_...` e testar o fluxo completo até a confirmação de pagamento
- **Testes de regressão visual:** Playwright suporta screenshot comparison — útil para garantir que o tema da loja não quebra após mudanças de CSS
