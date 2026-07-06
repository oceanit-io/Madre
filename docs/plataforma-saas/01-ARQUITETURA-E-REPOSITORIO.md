# 01 — Arquitetura e Estrutura do Repositório

[← voltar ao índice](./README.md)

---

## 1. Resumo geral da arquitetura

### 1.1 A estrutura escolhida

Uma única **base de código** Next.js 14 (App Router) + TypeScript + Supabase,
**deployada várias vezes** — uma instância isolada por cliente.

```
                ┌──────────────────────┐   ┌─────────────────┐
 cliente-a.dom ►│ Vercel (projeto A)   │──►│ Supabase A      │  domínio A
                │ MESMO repositório    │   └─────────────────┘
                └──────────────────────┘
                ┌──────────────────────┐   ┌─────────────────┐
 cliente-b.dom ►│ Vercel (projeto B)   │──►│ Supabase B      │  domínio B
                │ MESMO repositório    │   └─────────────────┘
                └──────────────────────┘
                         ▲
                         │ todos puxam do mesmo repo GitHub
                ┌────────┴─────────┐
                │ 1 repositório    │  ← um fix aqui chega em todos
                └──────────────────┘
```

Cada instância:

- Roda o **mesmo código** (mesmo repo, mesma branch de produção).
- Tem seu **próprio Supabase** (dados 100% isolados).
- Tem seu **próprio domínio/subdomínio**.
- É configurada por **variáveis de ambiente** (marca, credenciais, feature flags).

### 1.2 Por que faz sentido para o momento atual

- **Acaba com a duplicação de código** sem abrir mão do isolamento. O repo é um
  só; o que separa os clientes é **infra + configuração**, não cópia de código.
- **Isolamento físico de dados** — não depende de RLS perfeito para evitar
  vazamento entre clientes (esse é o ganho de segurança do silo).
- **Aproveita o que já existe** — o código já é white-label por env
  (ver [`../WHITE_LABEL.md`](../WHITE_LABEL.md) e [`src/lib/brand.ts`](../../src/lib/brand.ts)).
  A evolução principal é **automatizar o provisionamento** (doc 02).

### 1.3 Como cresce no futuro sem refazer tudo

- **Mais clientes** = rodar o script de provisionamento. O código não muda.
- **Feature nova só para um cliente** = uma flag de ambiente (`FEATURE_*`).
- **Gateway de pagamento novo** = um novo *adapter* (seção 4), sem tocar no checkout.
- **Super-admin** (futuro) = um serviço que agrega dados das N instâncias (doc 02).
- **Cliente gigante** = continua isolado; pode receber um plano Supabase maior
  só pra ele, sem afetar ninguém.

### 1.4 Decisões por horizonte

| Horizonte | Decisão | Motivo |
|---|---|---|
| **Curto** (agora) | 1 repo, silo, **script de provisionamento**, feature flags | Resolve manutenção e onboarding sem perder isolamento |
| **Médio** | Adapters de pagamento/catálogo, runner de migrations, ambiente de homologação, monitoramento | Suportar variação entre clientes e operar muitos bancos |
| **Longo** | Super-admin (agregação multi-instância), observabilidade, automação total de onboarding | Suportar 100 clientes × 300 revendedoras |

---

## 2. Estrutura do repositório

> Princípio: **o que é do core mora no código; o que varia por cliente é
> *configuração* (env), não *código*.** Nada de pastas "por cliente".

```
src/
├── app/                         # Rotas (App Router)
│   ├── (storefront)/            # Vitrine pública
│   │   └── loja/[slug]/         # Loja de uma revendedora (tenant B2C)
│   ├── (painel)/                # Área logada da revendedora
│   │   ├── dashboard/  vendas/  saldo/  configurar-loja/
│   ├── admin/                   # Admin do cliente (dono da empresa)
│   ├── carrinho/  checkout/
│   └── api/                     # Route handlers (backend)
│       ├── revendedora/         # Protegidas (revendedora logada)
│       ├── admin/               # Protegidas (admin do cliente)
│       └── webhook/             # Webhooks (Pagar.me etc.)
│
├── components/
│   ├── ui/                      # Base (botão, input, card, modal) — sem regra de negócio
│   ├── storefront/  painel/  admin/
│
├── lib/                         # Lógica de negócio e integrações (sem React)
│   ├── brand.ts                 # Marca, lida das envs NEXT_PUBLIC_BRAND_*
│   ├── features.ts              # ★ Leitura das feature flags (env)
│   ├── pagamentos/              # ★ Adapters de gateway (seção 4)
│   │   ├── PagamentoProvider.ts # interface comum
│   │   ├── pagarme.ts
│   │   └── index.ts             # factory: escolhe o adapter pela config
│   ├── catalogo/                # ★ Adapters de fonte de catálogo
│   │   ├── CatalogoSource.ts
│   │   ├── tray.ts  manual.ts
│   │   └── index.ts
│   ├── supabase/                # Clients Supabase (browser, server, admin)
│   ├── correios.ts  frete.ts  traySync.ts   # Integrações existentes
│
├── hooks/                       # React hooks de client component
├── types/                       # Tipos/interfaces TypeScript
├── utils/                       # Funções puras (formatação, validação BR…)
└── middleware.ts                # Auth/guards (NÃO precisa resolver "qual cliente" — a instância já é de um cliente)

supabase/
├── migrations/                  # ★ Migrations numeradas (fonte da verdade do schema)
└── ...
scripts/
├── provisionar-cliente.ts       # ★ Cria Supabase + Vercel + env de um cliente novo
└── aplicar-migrations.ts        # ★ Runner: aplica migrations pendentes em todas as instâncias
docs/
public/branding/                 # Assets de marca (default/fallback)
```

> **Diferença importante vs. um SaaS de banco único:** aqui o `middleware.ts`
> **não** precisa descobrir "de qual cliente é esse request" — cada deploy já
> pertence a um cliente só (definido pelas envs). O middleware cuida de auth e
> guards de rota. A resolução de tenant que existe é só a da **revendedora**
> (`/loja/[slug]`), que já funciona.

### 2.1 Onde colocar cada coisa

| Tipo | Onde | Regra |
|---|---|---|
| Página/rota | `src/app/.../page.tsx` | Server Component por padrão; `'use client'` só quando precisar de estado/efeito |
| Layout | `src/app/.../layout.tsx` | Tema/marca do cliente (lido das envs) entra aqui |
| Componente visual | `src/components/` | Sem regra de negócio; recebe dados por props |
| Regra de negócio / integração | `src/lib/` | **Nunca** importa React. Preço, split, frete, comissão |
| Hook de client | `src/hooks/` | Só para componentes `'use client'` |
| Tipo/interface | `src/types/` | Compartilhado entre arquivos |
| Função utilitária pura | `src/utils/` | Sem efeito colateral, sem I/O |
| Script de operação | `scripts/` | Provisionamento, migrations |

### 2.2 Separação: o que é global × o que é por cliente

| Global (vive no **código**, igual pra todos) | Por cliente (vive na **config/env**, varia) |
|---|---|
| Fluxo de checkout, carrinho, frete | Logo, cores, fontes, nome da marca (`NEXT_PUBLIC_BRAND_*`) |
| Regras de split e comissão | **Valores** dos percentuais e recipients |
| Componentes de UI | Quais features estão ligadas (`FEATURE_*`) |
| Integração Correios/Tray/Pagar.me (código) | Credenciais de cada cliente (`PAGARME_*`, token Tray) |
| Estrutura de tabelas e RLS (migrations) | Os **dados** (revendedoras, pedidos…) — em banco isolado |

> **Regra de ouro:** se você está prestes a escrever `if (cliente === 'fulano')`
> no código, pare. Isso vira uma **feature flag** (env) ou um **adapter**.

### 2.3 Como evitar duplicação de código

1. **Nada de pasta por cliente no código.** Diferença de cliente = env, não arquivo.
2. **Adapters** para o que muda de forma estrutural (gateway, catálogo).
3. **Feature flags** para ligar/desligar módulos.
4. **Componentes `ui/` burros** reusados em todo lugar.
5. **Lógica em `lib/`**, nunca copiada dentro de componentes.

> O isolamento entre clientes é por **infra** (Vercel/Supabase separados), não por
> cópia de código. Esse é exatamente o ponto que resolve a dor de manutenção.

---

## 3. Configuração por cliente (feature flags e personalização)

### 3.1 Onde a config mora

Como cada cliente é um **deploy separado**, a config vive nas **variáveis de
ambiente** do projeto Vercel daquele cliente. Já é o modelo do
[`../WHITE_LABEL.md`](../WHITE_LABEL.md):

| Tipo | Exemplo de env |
|---|---|
| Marca | `NEXT_PUBLIC_BRAND_NOME`, `NEXT_PUBLIC_BRAND_COR`, `NEXT_PUBLIC_BRAND_LOGO_*` |
| Catálogo | `NEXT_PUBLIC_BRAND_CATALOGO=tray\|manual` |
| Pagamento | `PAGARME_SECRET_KEY`, recipients, percentuais |
| Feature flags | `FEATURE_ECOMMERCE`, `FEATURE_WHATSAPP`, `FEATURE_RELATORIO` |

### 3.2 Como ler no código

```ts
// src/lib/features.ts
export const features = {
  ecommerceProdutosManuais: process.env.FEATURE_ECOMMERCE === 'true',
  integracaoWhatsapp:       process.env.FEATURE_WHATSAPP === 'true',
  relatorioAvancado:        process.env.FEATURE_RELATORIO === 'true',
} as const
```

```tsx
// esconder na UI
{features.ecommerceProdutosManuais && <ModuloProdutosManuais />}
```

```ts
// proteger o endpoint (não basta esconder a UI)
if (!features.relatorioAvancado) {
  return NextResponse.json({ error: 'feature_indisponivel' }, { status: 404 })
}
```

> **Segurança:** esconder no frontend **não basta** — valide a feature também no
> route handler. Esconder o botão evita confusão; bloquear no servidor evita abuso.

### 3.3 O "e-commerce" dos clientes 2 e 3 = feature, não produto

Conforme esclarecido, o "e-commerce" é só o **cadastro manual de produtos**.
Então é a flag `FEATURE_ECOMMERCE=true` + `NEXT_PUBLIC_BRAND_CATALOGO=manual`.
Nenhum repositório separado é necessário.

---

## 4. Padrão Adapter (pagamento e catálogo plugáveis)

Clientes usam gateways e fontes de catálogo diferentes. Para não encher o código
de `if`, o core fala com uma **interface**, e cada implementação é um *adapter*.
A escolha vem da config (env) daquele cliente.

### 4.1 Pagamento

```ts
// src/lib/pagamentos/PagamentoProvider.ts
export interface PagamentoProvider {
  criarCobranca(pedido: PedidoParaCobranca): Promise<ResultadoCobranca>
  processarWebhook(payload: unknown): Promise<EventoPagamento>
  criarRecebedor(dados: DadosKYC): Promise<Recebedor>   // split / KYC
}
```

```ts
// src/lib/pagamentos/index.ts — factory escolhe pela env do cliente
import { PagarmeAdapter } from './pagarme'

export function getPagamentoProvider(): PagamentoProvider {
  switch (process.env.PAGAMENTO_GATEWAY ?? 'pagarme') {
    case 'pagarme': return new PagarmeAdapter()
    // case 'outro': return new OutroAdapter()
    default: throw new Error(`Gateway não suportado: ${process.env.PAGAMENTO_GATEWAY}`)
  }
}
```

O checkout chama `getPagamentoProvider().criarCobranca(...)` e **não sabe** qual
gateway é. Banco novo = criar um adapter + um `case`.

### 4.2 Catálogo

Mesma ideia. Fontes: `tray` (sync automático), `manual` (CRUD no admin), e outras
no futuro. Interface comum `CatalogoSource` com `sincronizar()` / `listarProdutos()`.
O resto do sistema só conhece a tabela `produtos`, não de onde os dados vieram.

---

## 5. Autenticação e permissões

### 5.1 Perfis (roles)

| Perfil | Quem é | Escopo |
|---|---|---|
| `super_admin` | Equipe (Gabriela) | Todas as instâncias (futuro; via agregação — doc 02) |
| `cliente_admin` | Dono da empresa de prata | A **instância dele** (já é isolada por infra) |
| `revendedora` | Operadora de uma loja | Os **próprios** dados, dentro do banco do cliente |
| (anônimo) | Comprador final | Leitura de vitrine + criar pedido (guest) |

> No silo, o `cliente_admin` já está naturalmente isolado: ele só tem acesso ao
> deploy/banco do próprio cliente. Não há `cliente_id` para filtrar — o banco
> inteiro **é** daquele cliente.

### 5.2 RLS — para isolar revendedoras DENTRO do banco do cliente

O RLS continua importante, mas agora o escopo é **revendedora × revendedora**
dentro de um mesmo banco (já existe hoje), não cliente × cliente (isso é feito
pela infra). Cada revendedora só enxerga seus próprios pedidos/comissões/saldo.

### 5.3 Camadas de proteção (defesa em profundidade)

```
1. middleware.ts  → exige sessão nas rotas protegidas
2. route handler  → revalida sessão e role (getRevendedoraFromRequest, checkAdminAuth)
3. RLS no banco   → revendedora só acessa as próprias linhas
```

> **Nunca confie só no frontend.** Esconder um menu não protege um endpoint.

### 5.4 Segurança entre clientes

No silo, o isolamento entre clientes é **físico** (bancos separados) — esse é o
grande ganho da escolha. Os cuidados que sobram:

- **Nunca** compartilhar `service_role key` / segredos entre projetos.
- Cada projeto Vercel/Supabase com suas **próprias** credenciais.
- Garantir que o **script de provisionamento** não reaproveite chaves de um
  cliente em outro.

---

[← voltar ao índice](./README.md) · [próximo: 02 — Banco e Supabase →](./02-BANCO-E-SUPABASE.md)
