# 03 — Ambientes, Branches e Deploy

[← voltar ao índice](./README.md)

---

## 1. Estratégia de branches

> **Nota honesta sobre o pedido original:** o plano inicial citava 3 branches
> longas — `dev` → `test` → `production`. Isso funciona, mas para uma equipe
> pequena na Vercel costuma ser mais peso do que ajuda (todo merge vira 3
> merges). Abaixo descrevo o modelo de 3 ambientes **honrando essa intenção**,
> mas usando o jeito nativo da Vercel: branches longas só para os ambientes
> estáveis, e o resto via **preview deploys automáticos**.

### 1.1 Branches longas (permanentes)

| Branch | Ambiente | Deploy | Quem mexe |
|---|---|---|---|
| `production` (ou `main`) | **Produção** | Automático (Vercel Production) | Ninguém direto — só via merge de `test` |
| `test` | **Homologação** | Automático (Vercel Preview fixo) | Merge de features prontas para validar |
| `dev` | **Integração/dev** | Automático (Vercel Preview fixo) | Integração contínua do time |

> Se o time for 1–2 pessoas, dá para **colapsar `dev`** e usar só
> `test` + `production` + previews por feature. Comece simples; adicione `dev`
> só quando houver gente suficiente para justificar.

### 1.2 Branches curtas (temporárias)

| Prefixo | Para quê | Sai de | Volta para |
|---|---|---|---|
| `feature/` | Nova funcionalidade | `dev` | `dev` |
| `fix/` | Correção não urgente | `dev` | `dev` |
| `hotfix/` | Correção **urgente em produção** | `production` | `production` **e** `dev`/`test` |
| `release/` | Preparar uma versão (opcional) | `test` | `production` |

Exemplos de nome: `feature/cadastro-produtos-manual`,
`fix/frete-sedex-prazo`, `hotfix/webhook-pagarme-duplicado`.

### 1.3 Fluxo normal de trabalho

```
feature/x ──► (PR) ──► dev ──► (validou) ──► test ──► (homologou) ──► production
   │                    │                     │                          │
 preview             preview              preview                    PRODUÇÃO
 por commit          de integração        de homologação
```

1. Cria `feature/x` a partir de `dev`.
2. Abre **Pull Request** para `dev`. A Vercel gera um **preview** automático do PR.
3. Revisão de código + teste no preview → merge em `dev`.
4. Quando o conjunto está pronto, merge `dev` → `test` e valida em homologação.
5. Homologado, merge `test` → `production`. Deploy de produção é automático.

### 1.4 Hotfix (urgência em produção)

```
production ──► hotfix/y ──► (PR) ──► production   (deploy imediato)
                   └──────────────► dev / test    (pra não "perder" o fix)
```

### 1.5 O que **nunca** fazer

- ❌ Commit direto em `production`. **Sempre** via PR/merge.
- ❌ `git push --force` em `production`/`test`/`dev`.
- ❌ Merge sem o preview ter sido testado.
- ❌ Subir migration de banco direto em produção sem ter rodado em `test`.
- ❌ Misturar várias features numa branch só ("PR gigante").

### 1.6 Padrão de commits (Conventional Commits, em pt-BR)

Já é o padrão do projeto. Formato:

```
tipo(escopo): resumo no imperativo

Corpo explicando POR QUÊ (não o quê).

Co-Authored-By: Claude <noreply@anthropic.com>
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`, `test`, `style`.
Exemplos: `feat(scripts): provisionamento automatizado de cliente novo`,
`fix(rls): comissão de uma revendedora aparecia para outra`.

---

## 2. Ambientes

| Ambiente | URL | Banco | Para quê |
|---|---|---|---|
| **Local** | `localhost:3000` | Supabase de dev (ou branch do Supabase) | Desenvolver na máquina |
| **Dev** | preview Vercel fixo | Supabase de dev | Integrar trabalho do time |
| **Homologação (test)** | preview Vercel fixo | Supabase de **staging** | Validar antes de produção |
| **Produção** | domínio real | Supabase de **produção** | Clientes reais |

> **Importante:** homologação **não pode** apontar para o banco de produção.
> Senão um teste cria/apaga dado real. Use um projeto Supabase separado para
> staging, ou os **Supabase Branches** (banco efêmero por branch).

---

## 3. Variáveis de ambiente

> **Correção ao plano original:** o ChatGPT sugeriu arquivos `.env.staging` e
> `.env.production` versionados por ambiente. **Com a Vercel isso é anti-padrão.**
> Em produção/preview as variáveis ficam no **painel da Vercel**, escopadas por
> ambiente (Production / Preview / Development). Arquivos `.env*` são só para a
> máquina local.

### 3.1 Arquivos `.env` (locais)

| Arquivo | Versionado no Git? | Para quê |
|---|---|---|
| `.env.example` | ✅ **Sim** | Modelo com todas as chaves, **sem valores reais** |
| `.env.local` | ❌ **Nunca** | Seus valores reais de desenvolvimento |

`.gitignore` deve conter `.env*` **exceto** `.env.example`:

```gitignore
.env*
!.env.example
```

### 3.2 Variáveis na Vercel (preview e produção)

Configuradas no painel da Vercel, **escopadas por ambiente**. Cada ambiente
aponta para o seu banco/credenciais.

### 3.3 Quais variáveis existem

> No modelo **silo**, cada cliente é um **deploy próprio**, então **todas** as
> variáveis daquele cliente (inclusive marca e credenciais) vivem no **projeto
> Vercel dele**. Não há tabela de config compartilhada — a config é o conjunto de
> envs de cada instância. (É o modelo já descrito em [`../WHITE_LABEL.md`](../WHITE_LABEL.md).)

| Categoria | Exemplos | Observação |
|---|---|---|
| Supabase (do cliente) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | O Supabase **daquele** cliente |
| App / marca | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BRAND_*`, `NEXT_PUBLIC_BRAND_CATALOGO` | Identidade do cliente |
| Feature flags | `FEATURE_ECOMMERCE`, `FEATURE_WHATSAPP`, `FEATURE_RELATORIO` | Liga/desliga módulo por cliente |
| Pagamento (do cliente) | `PAGARME_SECRET_KEY`, recipients, percentuais | Credenciais **só** daquele cliente |
| Integrações | `RESEND_API_KEY`, chaves Correios, token Tray | Por cliente |
| Operação (não vai no deploy) | `SUPABASE_ACCESS_TOKEN`, token Vercel | Só nos **scripts** de provisionamento/migrations |

> **Dois cuidados de segurança:**
> 1. Segredo **nunca** em `NEXT_PUBLIC_*` — esse prefixo vaza para o navegador.
> 2. `SUPABASE_ACCESS_TOKEN` e o token da Vercel (usados para provisionar e rodar
>    migrations) ficam **só no ambiente de operação/CI**, nunca dentro do app.

### 3.4 O que **nunca** commitar

- ❌ `service_role key`, secrets de Pagar.me, tokens Tray, `SUPABASE_ACCESS_TOKEN`.
- ❌ Qualquer `.env` com valor real.
- ❌ Chave privada em `NEXT_PUBLIC_*`.
- Se vazar algum segredo: **rotacionar a chave** imediatamente (trocar no
  provedor), não basta remover do commit.

---

## 4. Deploy

### 4.1 Como funciona

- **Vercel conectada ao GitHub.** Push/merge → deploy automático.
- `production`/`main` → **Production**. `dev`/`test` e PRs → **Preview**.
- Rollback de 1 clique: a Vercel guarda os deploys anteriores
  ("Promote to Production" no deploy bom anterior).

### 4.2 Deploy de banco × deploy de código (cuidado)

Código e banco são **deploys separados**. No silo há **vários bancos** (um por
cliente), então a migration é aplicada via **runner** (doc 02 §5). Ordem segura:

1. Aplicar a **migration** com o runner no ambiente alvo
   (`aplicar-migrations.ts --env test`, depois em todas as instâncias de produção).
2. Só então fazer merge do **código** que depende dela.

Migration deve ser **retrocompatível** quando possível (adicionar antes de
remover), para o código antigo não quebrar durante a janela do deploy — isso é
ainda mais importante aqui, porque os N bancos não migram exatamente no mesmo
instante.

### 4.3 Como evitar que código de dev vá para produção

- Só `test` → `production` chega em produção; nada pula etapa.
- Branch protegida em `production` (exigir PR + revisão).
- Feature incompleta fica atrás de **feature flag desligada** até estar pronta.

### 4.4 Checklist antes de cada deploy de produção

```
[ ] `npx tsc --noEmit` sem erros
[ ] `npx next build` passou localmente
[ ] Testado no preview de homologação (test)
[ ] Migration (se houver) testada em test e aplicada via runner em TODAS as instâncias de produção
[ ] Migration é retrocompatível / idempotente
[ ] Variáveis novas configuradas na Vercel (Production) de cada cliente afetado
[ ] Segredos novos NÃO estão em NEXT_PUBLIC_*
[ ] Security Advisor do Supabase sem alertas novos de RLS
[ ] Plano de rollback claro (qual deploy promover de volta)
```

### 4.5 Rollback

- **Código:** "Promote to Production" no último deploy bom (segundos).
- **Banco:** mais difícil — por isso migrations retrocompatíveis. Se uma
  migration quebrou, ter o **script de reversão** pronto (ou restore do backup,
  que afeta todos os clientes — último recurso).

---

[← anterior: 02 — Banco e Supabase](./02-BANCO-E-SUPABASE.md) · [próximo: 04 — Padrões de Código →](./04-PADROES-DE-CODIGO.md)
