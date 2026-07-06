# Testes de Carga — k6

Scripts para simular múltiplos usuários simultâneos na `lojadeprata925.com.br`.

## Pré-requisito

```bash
choco install k6   # Windows — já instalado
k6 version         # confirma k6 v2.0.0+
```

Variáveis em `.env.test` (raiz do projeto):

```env
BASE_URL=https://lojadeprata925.com.br
TEST_EMAIL=email-da-revendedora-de-teste
TEST_PASSWORD=senha
ADMIN_TOKEN=valor-do-ADMIN_PIN-na-Vercel
SUPABASE_ANON_KEY=eyJ...   # Supabase → Settings → API → anon public
TEST_STORE_SLUG=slug-da-loja
```

## Comandos

```bash
# Vitrine pública sob carga
npm run test:load:vitrine

# Calculadora de frete (Correios PPN)
npm run test:load:frete

# Cadastros simultâneos
npm run test:load:cadastro

# Mix realista — 4 modos de intensidade:
npm run test:load:smoke      # 2 VUs,  1 min   — sanidade rápida (seguro em prod)
npm run test:load:carga      # 20 VUs, 5 min   — tráfego normal
npm run test:load:stress     # rampa até 80 VUs — descobre o limite da plataforma
npm run test:load:spike      # pico repentino de 60 VUs (simula influencer)

# Endpoints autenticados (dashboard revendedora + admin)
npm run test:load:autenticado
```

Todos os testes geram relatório HTML em `tests/load/reports/` automaticamente.

## Scripts e o que cada um cobre

| Arquivo | VUs máx | Endpoints testados |
|---|---|---|
| `browse-storefront.js` | 40 | `GET /loja/[slug]`, `GET /api/loja/[slug]`, `GET /api/produtos` |
| `calcular-frete.js` | 20 | `GET /api/cep/[cep]`, `POST /api/frete` |
| `cadastro-concorrente.js` | 20 | `GET /auth/register`, `POST /api/auth/status-email` |
| `stress-mix.js` | 2–80 | Mix: 50% vitrine, 25% frete, 15% cadastro, 10% checkout |
| `autenticado.js` | 10 | `/api/revendedora/meu-status`, `/financeiro`, `/pedidos`, `/api/admin/stats`, `/api/admin/revendedoras` |

## Relatórios HTML

Abra o HTML gerado em `tests/load/reports/` — tem 3 abas:

- **Detailed Metrics** — p(95), p(90), avg, min, max por métrica. Linhas `endpoint_*` mostram cada URL separada em cores verde/vermelho conforme threshold.
- **Test Run Details** — VUs, iterações, total de requests, dados transferidos, checks passados/falhados.
- **Checks & Groups** — % de sucesso por check nomeado (ex: `produtos 200: 49%`).

## Como ler as métricas

```
✗ endpoint_produtos_ms: avg=29.95s  p(95)=60s   ← VERMELHO — threshold estourou
✓ endpoint_vitrine_ms:  avg=251ms   p(95)=368ms  ← VERDE — passou
✓ endpoint_frete_ms:    avg=610ms   p(95)=1.31s  ← VERDE — passou

http_req_failed: 13.99%   ← taxa de erro geral (meta: < 5%)
checks.........: 87.94%   ← validações que passaram (meta: > 98%)
```

**`p(95)`** = 95% dos usuários esperaram menos que esse tempo. É o número que importa — ignora picos isolados.

## Thresholds definidos (stress-mix)

| Métrica | Limite | O que significa se estourar |
|---|---|---|
| `http_req_duration` p(95) | < 4s | Usuário médio esperando mais de 4s |
| `http_req_failed` | < 5% | Mais de 5% das requests falhando |
| `endpoint_vitrine_ms` p(95) | < 3s | Página da vitrine lenta |
| `endpoint_produtos_ms` p(95) | < 5s | API de produtos travando |
| `endpoint_frete_ms` p(95) | < 8s | Correios lento (tolerância maior por ser externo) |
| `endpoint_cep_ms` p(95) | < 3s | Lookup de CEP lento |
| `endpoint_register_ms` p(95) | < 3s | Página de cadastro lenta |

## Resultados registrados (2026-06-25)

### Smoke (2 VUs) ✅
| Métrica | Valor |
|---|---|
| `http_req_failed` | 0.00% |
| `http_req_duration` p(95) | 1.871s |
| Checks | 100% |

### Autenticado (10 VUs) ✅
| Endpoint | p(95) |
|---|---|
| `revendedora/meu-status` | 371ms |
| `revendedora/financeiro` | 486ms |
| `admin/stats` | 245ms |

### Stress (80 VUs) — resultado por endpoint
| Endpoint | p(95) | Status |
|---|---|---|
| Vitrine HTML | 368ms | ✅ |
| CEP | 260ms | ✅ |
| Registro | 155ms | ✅ |
| Frete (Correios) | 1.31s | ✅ |
| `/api/produtos` | **60s (timeout)** | ❌ corrigido — ver abaixo |

### Problema identificado e corrigido — `/api/produtos`

**Causa:** `force-dynamic` desabilitava o cache do Next.js + havia um segundo SELECT desnecessário ao banco para montar a árvore de categorias.

**Correção aplicada em `src/app/api/produtos/route.ts`:**
- Substituído `export const dynamic = 'force-dynamic'` por `export const revalidate = 60`
- Removed o segundo SELECT — a árvore de categorias agora é construída a partir dos dados já buscados

**Resultado esperado após deploy:** `endpoint_produtos_ms` p(95) < 500ms a qualquer carga.

## ⚠️ Regras de uso

- **`smoke` somente** é seguro para rodar contra produção (2 VUs)
- **`carga`, `stress` e `spike` apenas em staging** — com 80 VUs o Supabase free tier (60 conexões) pode ser esgotado, derrubando usuários reais
- **Nunca** adicionar `POST /api/pedidos` nos scripts — cria pedidos reais com cobrança
- **Nunca** usar e-mails reais — somente `@example-load-test.invalid`
- Se rodar stress em produção por engano e o site cair: Supabase Dashboard → Settings → General → **Restart project** (reseta o pool de conexões em ~30s)

## Planos futuros

### Carrinho sob carga
O carrinho usa `localStorage` — k6 HTTP puro não consegue testar. Opção: **k6 browser module** (Chrome headless dentro do k6).

### Webhook Pagar.me sob carga
Simular 20 webhooks simultâneos em `POST /api/webhook/pagarme` para validar idempotência sob concorrência.

### Checkout com pagamento (staging)
Criar `.env.staging` com `PAGARME_API_KEY=ak_test_...` para testar `POST /api/pedidos` sem criar pedidos reais.

### Rodar stress pós-correção
Após o deploy da correção do `/api/produtos`, rodar `npm run test:load:stress` novamente e comparar com os relatórios em `reports/`. Espera-se 0% de falhas a 80 VUs.
