# 04 — Padrões de Código e Documentação Interna

[← voltar ao índice](./README.md)

---

## 1. Princípios (já valem no projeto, reforçados aqui)

1. **TypeScript strict.** Evitar `any`; preferir `unknown` + narrowing.
2. **Server-first.** Preço, split, frete, comissão **sempre** recalculados no
   servidor. Nunca confiar em valor vindo do client.
3. **Isolamento por revendedora.** Toda query da revendedora filtra pelo
   `revendedora_id` dela (o isolamento entre clientes já é por infra — silo).
4. **Best-effort em serviços externos.** Falha de e-mail/gateway nunca quebra o
   pedido — `try/catch` em toda chamada externa.
5. **Idempotência em webhooks.** Mesma mensagem 2× não duplica efeito.
6. **Comente o porquê, não o quê.**

---

## 2. Nomenclatura

| Item | Padrão | Exemplo |
|---|---|---|
| Componente React | `PascalCase` | `CardProduto.tsx` |
| Hook | `camelCase` com `use` | `useCarrinho.ts` |
| Função / variável | `camelCase` | `calcularComissao()` |
| Tipo / interface | `PascalCase` | `Cliente`, `PedidoParaCobranca` |
| Constante global | `UPPER_SNAKE_CASE` | `FRETE_GRATIS_MINIMO` |
| Arquivo de lib | `camelCase` | `traySync.ts`, `frete.ts` |
| Rota / pasta de rota | `kebab-case` | `configurar-loja/` |
| Tabela / coluna SQL | `snake_case` | `revendedora_id`, `valor_comissao` |

> Idioma: nomes de domínio em **pt-BR** (`revendedora`, `comissao`, `saldo`) —
> consistente com o que já existe. Termos técnicos em inglês quando padrão da
> linguagem (`provider`, `adapter`, `handler`).

---

## 3. Padrão de componentes

- **Server Component por padrão.** `'use client'` só quando há estado, efeito ou
  evento de UI.
- Componente **não busca dado** quando pode receber por props. Busca de dados
  fica no Server Component / route handler.
- Componentes de `ui/` são **burros**: sem regra de negócio, sem fetch.
- Cada componente trata seus 3 estados: **loading**, **erro** e **vazio**.

```tsx
// App Router: arquivos especiais por rota
app/vendas/
  page.tsx        // conteúdo
  loading.tsx     // skeleton enquanto carrega
  error.tsx       // fallback de erro (client component)
```

### Empty / loading / feedback

| Estado | Como tratar |
|---|---|
| **Loading** | `loading.tsx` (skeleton) ou estado local em client component |
| **Vazio** | Mensagem + ação ("Nenhuma venda ainda. Compartilhe sua loja!") |
| **Erro** | `error.tsx` + mensagem amigável; logar o detalhe técnico no servidor |
| **Sucesso/ação** | Toast/feedback curto; nunca deixar o usuário sem resposta |

---

## 4. Padrão de serviços / API (route handlers)

Estrutura recomendada de um handler:

```ts
export async function POST(req: Request) {
  try {
    // 1. Autenticar / autorizar (sessão + role). A instância já é de um cliente.
    const rev = await getRevendedoraFromRequest(req)
    if (!rev) return json({ error: 'nao_autorizado' }, 401)

    // 2. Checar feature flag (se aplicável) — flag por deploy (env)
    if (!features.relatorioAvancado) return json({ error: 'indisponivel' }, 404)

    // 3. Validar input (zod recomendado)
    const body = schema.parse(await req.json())

    // 4. Lógica — filtrando pelos dados DA revendedora logada
    const dados = await buscar(rev.id, body)

    return json({ ok: true, dados })
  } catch (e) {
    // 5. Erro tratado, log no servidor, resposta limpa
    console.error('[vendas]', e)
    return json({ error: 'erro_interno' }, 500)
  }
}
```

- **Webhooks sempre retornam 200** (logar e seguir; o gateway reenvia em loop se
  não receber 200).
- **Validação de input** com `zod` (ou similar) — não confiar no shape do body.

---

## 5. Estado global (client)

- O projeto usa **React Context** (ex.: `CarrinhoContext` com localStorage).
  Manter esse padrão; não introduzir Redux/Zustand sem necessidade real.
- Estado de servidor (dados do banco) **não** vai para Context — busca-se no
  Server Component ou via route handler.

---

## 6. Tipos e interfaces

- Centralizar tipos compartilhados em `src/types/`.
- Gerar tipos do banco com a CLI do Supabase (`supabase gen types typescript`)
  em `src/types/database.ts` — mantém o TS alinhado ao schema.
- Tipar a config/marca lida das envs (no silo a config é por deploy, não no banco):

```ts
// src/lib/brand.ts (essência) — lê das envs do deploy daquele cliente
export const brand = {
  nome: process.env.NEXT_PUBLIC_BRAND_NOME ?? 'Loja de Prata 925',
  cor:  process.env.NEXT_PUBLIC_BRAND_COR ?? '#000000',
  catalogo: (process.env.NEXT_PUBLIC_BRAND_CATALOGO ?? 'tray') as 'tray' | 'manual',
} as const

// src/lib/features.ts — flags por deploy
export const features = {
  ecommerceProdutosManuais: process.env.FEATURE_ECOMMERCE === 'true',
} as const
```

---

## 7. Tratamento de erros

- **Erros esperados** (validação, não autorizado): resposta HTTP clara com código
  de erro legível (`{ error: 'cliente_nao_encontrado' }`).
- **Erros inesperados:** `try/catch`, log no servidor, resposta genérica 500 sem
  vazar stack para o cliente.
- **Serviço externo:** `try/catch` que **não derruba o fluxo principal** (e-mail
  que falha não cancela o pedido).

---

## 8. Tooling

| Ferramenta | Para quê | Observação |
|---|---|---|
| **TypeScript** | Tipagem | `strict: true`; `npx tsc --noEmit` no checklist |
| **ESLint** | Padrões e bugs | Config do Next.js (`next lint`) |
| **Prettier** | Formatação | Evita "diff de espaço"; rodar no pre-commit |
| **Husky + lint-staged** (sugerido) | Rodar lint/format/tsc antes do commit | Barra erro antes de subir |
| **Conventional Commits** | Histórico legível | Já é o padrão |
| **Revisão de código (PR)** | Segundo par de olhos | Foco extra em isolamento de credenciais e segredos em env |

> **Item de revisão obrigatório:** PR que mexe em provisionamento, envs ou
> migrations deve ser checado quanto a **isolamento de credenciais** (uma chave de
> um cliente não pode acabar em outro) e quanto a **segredo em `NEXT_PUBLIC_*`**.
> No silo, esses são os erros mais perigosos.

---

## 9. Documentação interna (quais arquivos o repo precisa)

Manter na raiz e em `docs/`. Alguns **já existem** — reaproveitar e atualizar.

| Arquivo | Existe hoje? | Conteúdo |
|---|---|---|
| `README.md` | ✅ | Visão geral, como rodar, links para `docs/` |
| `docs/ARCHITECTURE.md` | ✅ | Desenho do sistema, atores, fluxo principal |
| `CONTRIBUTING.md` | ❌ criar | Fluxo de branches, padrão de commit, como abrir PR, checklist |
| `docs/DEPLOY.md` | ❌ criar | Resumo do doc 03: como deployar cada ambiente, rollback |
| `docs/ENVIRONMENT.md` / `ENV_VARS.md` | ✅ (`ENV_VARS.md`) | Todas as variáveis, onde moram, quais são segredas |
| `docs/DATABASE.md` | ✅ | Tabelas, relacionamentos, RLS por revendedora, migrations |
| `CHANGELOG.md` | ❌ criar | Mudanças por versão (data + resumo) |

### Conteúdo de cada um

- **README.md** — o que é, como rodar local (`npm run dev`), como testar
  (`tsc --noEmit`, `next build`), links para `docs/`.
- **ARCHITECTURE.md** — atores, fluxo do clique à comissão, multi-tenant
  (cliente × revendedora), adapters.
- **CONTRIBUTING.md** — branches (doc 03), padrão de commit, abertura de PR,
  checklist de revisão (incluindo o check de isolamento de credenciais).
- **DEPLOY.md** — ambientes, ordem migration→código, checklist de deploy, rollback.
- **ENVIRONMENT.md / ENV_VARS.md** — tabela de variáveis, quais são segredas,
  o que vai no banco vs no env.
- **DATABASE.md** — schema, relacionamentos, policies RLS por revendedora, runner de migrations.
- **CHANGELOG.md** — uma linha por release: `## [data] feat: ...`.

### Como manter atualizada

- **Mudou env?** Atualiza `ENV_VARS.md` no mesmo PR (já é regra no CLAUDE.md).
- **Mudou banco?** Atualiza `DATABASE.md` + cria SQL em `supabase/`.
- **Mudou integração?** Atualiza `docs/integrations/`.
- Documentação faz parte do PR — PR que muda comportamento sem atualizar doc
  não deveria ser aprovado.

---

[← anterior: 03 — Ambientes e Deploy](./03-AMBIENTES-BRANCHES-DEPLOY.md) · [próximo: 05 — Escalabilidade, Riscos e Plano →](./05-ESCALABILIDADE-RISCOS-PLANO.md)
