# Testes E2E — Playwright

**Última execução:** 2026-06-22
**Ambiente:** Produção (`lojadeprata925.com.br`) — somente leitura
**Resultado:** ✅ 77 passaram · ⏭ 6 pulados (sem produtos na loja de teste) · ❌ 0 falharam

---

## O que são testes E2E?

Testes E2E (end-to-end) simulam um usuário real navegando no site: abrem o navegador, clicam em botões, preenchem formulários e verificam se o resultado é o esperado. São diferentes de testes unitários (que testam funções isoladas) — eles validam o sistema completo, do front ao banco de dados.

A ferramenta usada é o **Playwright**, que controla um navegador Chromium automaticamente.

---

## Como rodar os testes

### Pré-requisitos

1. Ter o arquivo `.env.test` configurado na raiz do projeto (ver seção abaixo)
2. Ter as dependências instaladas: `npm install`
3. Ter o Playwright instalado: `npx playwright install chromium`

### Arquivo `.env.test`

```env
BASE_URL=https://lojadeprata925.com.br
TEST_EMAIL=email-de-uma-revendedora@exemplo.com
TEST_PASSWORD=senha-da-revendedora
ADMIN_TOKEN=pin-admin-do-vercel
TEST_STORE_SLUG=slug-da-loja   # só o slug, ex: joias-da-ana (sem URL)
ALLOW_MUTATING_TESTS=false
```

> **Atenção:** `TEST_STORE_SLUG` deve ser apenas a parte final da URL, não a URL completa.
> Certo: `jarlessayharesantana-5310`
> Errado: `https://lojadeprata925.com.br/loja/jarlessayharesantana-5310`

### Comandos disponíveis

```bash
npm run test:e2e              # roda tudo (headless — sem abrir janela)
npm run test:e2e:headed       # roda com o navegador visível na tela
npm run test:e2e:ui           # abre interface visual interativa do Playwright
npm run test:e2e:report       # abre o relatório HTML da última execução
npm run test:e2e:smoke        # roda só os testes de fumaça (rotas públicas)
npm run test:e2e:security     # roda só os testes de segurança dos endpoints admin
```

---

## Cobertura atual

### O que é testado ✅

| Arquivo | Área | O que valida |
|---|---|---|
| `smoke.spec.ts` | Rotas públicas | Homepage, login, registro, esqueci-senha respondem sem erro 500 |
| `auth.spec.ts` | Autenticação | Login válido, login inválido, validação de campos, redirecionamento das 6 rotas protegidas sem sessão |
| `dashboard.spec.ts` | Painel da revendedora | Card de saldo, métricas, link da loja, BottomNav com 5 abas, botão Sacar, APIs sem 401 |
| `storefront.spec.ts` | Vitrine pública | Carregamento, hero/banner, barra de confiança (3 selos), drawer de categorias, campo de busca, grid de produtos ou estado vazio, loja inexistente, footer |
| `cart.spec.ts` | Carrinho | Estado vazio com CTA funcional |
| `checkout.spec.ts` | Formulário de checkout | Acesso sem itens redireciona, campos aceitam dados fictícios, pagamento real nunca é disparado |
| `admin-security.spec.ts` | Segurança admin | 10 endpoints sem token → 401/403, 3 endpoints com token errado → 401/403, proteção client-side do painel `/admin` |
| `responsive.spec.ts` | Mobile (393×851px) | Login sem overflow horizontal, botão ≥ 44px (tappable), loja sem overflow, header fixo após scroll, carrinho sem overflow, BottomNav fixo |

### O que é pulado e por quê ⏭

| Teste | Motivo | Como desbloquear |
|---|---|---|
| Carrinho — adicionar produto | Loja de teste sem produtos cadastrados | Sincronizar produtos na loja usada em `TEST_STORE_SLUG` |
| Carrinho — botões de quantidade | Idem | Idem |
| Carrinho — remover item | Idem | Idem |
| Carrinho — botão finalizar | Idem | Idem |
| Carrinho — calculadora de frete | Idem | Idem |
| Vitrine — produto tem botão de ação | Idem | Idem |

---

## O que falta cobrir

### Alta prioridade

| Área | O que testar | Por quê é importante |
|---|---|---|
| **Cadastro de revendedora** | Preencher formulário de registro, verificar feedback de sucesso/erro | Fluxo de aquisição — usuário novo testa isso primeiro |
| **Carrinho completo** | Adicionar produto → alterar quantidade → remover → ver total atualizado | Desbloqueado quando `TEST_STORE_SLUG` tiver produtos |
| **Calculadora de frete** | Digitar CEP → cotação Correios → exibir PAC e SEDEX com prazo e preço | Feature crítica para conversão; integração real com Correios |
| **Configurar loja** | Alterar nome, cor de tema, foto de perfil | Página central do onboarding de cada revendedora |

### Média prioridade

| Área | O que testar | Requisito |
|---|---|---|
| **Fluxo de checkout com sandbox** | Checkout ponta a ponta até gerar pedido | Chave Pagar.me `ak_test_...` (ambiente sandbox) |
| **Webhook Pagar.me** | Idempotência, mudança de status, geração de comissão | Endpoint público acessível (ex: ngrok em staging) |
| **Página de vendas** (`/vendas`) | Lista de pedidos da revendedora | Conta de teste com pedidos reais |
| **Página de saldo** (`/saldo`) | Histórico de saques, botão de saque | Idem |
| **Endpoints admin com token real** | Validar corpo das respostas de leitura | Configurar `ADMIN_TOKEN` com o PIN real do Vercel |

### Baixa prioridade

| Área | Motivo de baixa prioridade |
|---|---|
| Email transacional | Requer conta de teste no Resend; falha de email não quebra pedido |
| Desktop (1280px+) | A maioria das revendedoras e clientes acessa pelo celular |
| Safari/iOS real | Playwright usa WebKit como proxy — não idêntico ao Safari em iPhone real |

---

## Achados da execução

### Segurança
- Todos os 10 endpoints `/api/admin/*` rejeitam corretamente requisições sem token (401/403). Nenhuma rota admin está exposta publicamente.
- A página `/admin` tem proteção client-side via cookie `lp925_admin`. É uma dívida técnica documentada — deveria ser middleware server-side. Não é risco crítico porque os endpoints da API são protegidos server-side.
- O `ADMIN_TOKEN=prata925` no `.env.test` é um placeholder; o PIN real está nas variáveis de ambiente do Vercel.

### Funcionais
- Dashboard redireciona para `/configurar-loja` quando a conta de teste não tem `nome_loja` ou `foto_url` configurados. Comportamento esperado.
- `BottomNav` usa `position: fixed`, então o elemento wrapper pai tem `height: 0`. Os testes verificam `.toBeAttached()` no `nav` filho em vez de `.toBeVisible()` no wrapper.
- Checkout protege corretamente contra acesso sem itens no carrinho.
- Landing (`/`) retorna 404 num recurso de imagem no console — não impede a renderização, mas vale investigar.

### Seletores corrigidos após primeira execução
Três testes falharam na primeira rodada com `TEST_STORE_SLUG` ativo porque os textos no HTML real eram diferentes dos esperados:

| Teste | Texto esperado (errado) | Texto real na página |
|---|---|---|
| Auth — link esqueci senha | `'Esqueci minha senha'` | `'Esqueci a senha'` |
| Vitrine — barra de confiança | `'Prata 925'` (ambíguo: 7 elementos) | `strong` com texto exato `'Prata 925'` |
| Vitrine — barra de confiança | `'3x sem juros'` | `'Até 6x sem juros'` |
| Vitrine — footer | `footer > 'Prata 925'` (ambíguo: 2 elementos) | `footer > '© Prata 925'` |

---

## Estrutura dos arquivos

```
playwright.config.ts          # Configuração raiz (baseURL, timeouts, browsers)
tests/e2e/
├── helpers/
│   ├── env.ts                # Lê .env.test com guards de variáveis obrigatórias
│   └── test-data.ts          # Dados fictícios válidos (CPF, endereço, cartão fake)
├── auth.setup.ts             # Faz login e salva sessão em playwright/.auth/
├── smoke.spec.ts             # Rotas públicas
├── auth.spec.ts              # Autenticação e proteção de rotas
├── dashboard.spec.ts         # Painel da revendedora
├── storefront.spec.ts        # Vitrine pública
├── cart.spec.ts              # Carrinho
├── checkout.spec.ts          # Formulário de checkout
├── admin-security.spec.ts    # Segurança dos endpoints admin
└── responsive.spec.ts        # Layout mobile
playwright/.auth/             # gitignored — sessão salva entre testes
playwright-report/            # gitignored — relatório HTML + screenshots + vídeos
```

**Dependências adicionadas ao projeto:**
```json
"@playwright/test": "^1.60.0",
"dotenv-cli": "^11.0.0"
```
