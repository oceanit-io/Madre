# 05 — Escalabilidade, Riscos, Checklist e Plano

[← voltar ao índice](./README.md)

> Cenário-alvo: **~100 clientes × ~300 revendedoras = ~30.000 revendedoras**.
> No modelo **silo**, isso é **100 bancos pequenos** (~300 revendedoras cada),
> não um banco gigante. A escala vira um desafio **operacional** (gerenciar 100
> stacks), não de performance de um banco único.

---

## 1. Escalabilidade

### 1.1 Onde estão os gargalos potenciais

| Gargalo | Por quê | Mitigação |
|---|---|---|
| **Gerenciar 100 stacks** | Provisionar e migrar muitos bancos à mão é inviável | **Scripts** de provisionamento + **runner** de migrations (doc 02) |
| **Conexões ao Postgres** | Serverless (Vercel) abre muitas conexões curtas | **Connection Pooler / Supavisor** em cada projeto |
| **N+1 de queries** | Buscar item a item num loop | `select` com `in`/join; buscar em lote |
| **Storefront lento** | Renderizar vitrine a cada request | **Cache/ISR** por loja; CDN da Vercel |
| **Imagens pesadas** | Fotos de produto | `next/image` + Cloudinary/Storage com transform |
| **Visão consolidada (super-admin)** | Dados em 100 bancos | Rollup/agregação (doc 02 §10) |
| **Custo total de N projetos** | Cada Supabase Pro custa | COGS de clientes pagantes; subir plano só de quem precisa |

> Note que **não** aparecem aqui "tabela gigante", "partição por cliente" ou
> "vizinho barulhento" — esses problemas do banco compartilhado **não existem no
> silo**. Cada banco é pequeno e isolado.

### 1.2 Banco — boas práticas de performance (por instância)

- **Índices** que já existem (por `revendedora_id`, `status`, datas) bastam para
  ~300 revendedoras por banco.
- **Paginação:** nunca `select *` sem limite. Usar **keyset/cursor** em listas
  longas (histórico de pedidos).
- **Filtros no banco**, não no JS. `select` só das colunas necessárias.
- **Connection Pooler** ligado (essencial com serverless).

### 1.3 Frontend — performance

- **Server Components** para conteúdo que não muda por interação (menos JS).
- **ISR / cache** na vitrine pública (revalidar a cada X min).
- **Lazy load** de listas longas e componentes pesados.
- **`next/image`** para todas as imagens.
- Evitar bundles grandes; `dynamic import` no que é pesado.

### 1.4 Monitoramento e métricas

| O quê | Ferramenta |
|---|---|
| Erros/logs da app (por cliente) | Vercel (Logs, Observability) |
| Performance do banco (por cliente) | Supabase Reports + **Advisors** |
| Tabelas sem RLS / problemas de policy | **Supabase Security Advisor** |
| Uptime de cada instância | Monitor externo (UptimeRobot/BetterStack) |
| Erros no front | Sentry (sugerido, fase média) |
| **Saúde de todas as instâncias** | Painel próprio lendo `instancias.json` (futuro) |

### 1.5 O que preparar agora × o que deixar para depois

| Agora (barato e essencial) | Depois (quando crescer) |
|---|---|
| Scripts de provisionamento + runner de migrations | Onboarding 100% self-service |
| Connection pooler em cada projeto | Rollup central para super-admin |
| Paginação nas listas | Observabilidade full (Sentry, dashboards) |
| `next/image` + ISR na vitrine | Compute add-on só nos clientes pesados |
| `instancias.json` (registro central) | Painel de saúde multi-instância |

---

## 2. Riscos e pontos de atenção

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Provisionamento/migrations manuais não escalarem** | 🔴 Crítico | Investir nos **scripts** cedo (antes de ~5 clientes). É o calcanhar do silo. |
| **Credencial de um cliente vazar/ir parar em outro** | 🔴 Crítico | Cada projeto com suas envs; script nunca reaproveita chave; segredo nunca em `NEXT_PUBLIC_*` |
| **`SUPABASE_ACCESS_TOKEN` / token Vercel vazarem** | 🔴 Crítico | Só em ambiente de operação/CI; nunca no app; rotacionar se vazar |
| **Migration aplicada em parte das instâncias** (drift de schema) | 🟠 Alto | Runner com tabela `schema_migrations` + relatório por instância; migrations retrocompatíveis |
| **Repos copiados divergirem** (3 atuais) | 🟠 Alto | Convergir para o repositório único; parar de copiar repo |
| **Deploy quebra um cliente** | 🟡 Médio | Homologação + rollback de 1 clique. **Vantagem do silo:** quebra fica contida em 1 cliente |
| **Esquecer de migrar um banco** | 🟡 Médio | Runner roda em **todas** as instâncias do `instancias.json` |
| **Custo do Supabase crescer sem controle** | 🟡 Médio | Monitorar; Pro só em produção; add-on só em quem precisa |
| **Super-admin difícil (dados espalhados)** | 🟡 Médio | Rollup/agregação planejados (doc 02 §10) |
| **Sem ambiente de teste** | 🟡 Médio | Manter instância(s) de `test` |

> **Resumo do risco número 1 no silo:** o perigo **não** é vazamento de dados
> entre clientes (a infra separada resolve isso). O perigo é **operacional** —
> provisionar e migrar muitos bancos sem automação vira gargalo. Por isso os
> **scripts** (doc 02 §4 e §5) são a prioridade técnica número um.

---

## 3. Checklist de implantação

### 🟢 Curto prazo (fundação — fazer antes de escalar)

```
[ ] Repositório único definido como a base (parar de copiar repo)
[ ] Branches: dev, test, production (proteger production)
[ ] 3 ambientes na Vercel + variáveis por ambiente
[ ] Instância(s) Supabase de teste/homologação (separadas de produção)
[ ] Connection Pooler (Supavisor) ligado nas instâncias
[ ] supabase/migrations/ numeradas + tabela schema_migrations
[ ] scripts/aplicar-migrations.ts (runner) funcionando em test
[ ] scripts/provisionar-cliente.ts (Supabase + Vercel + env + domínio)
[ ] scripts/instancias.json (registro central das instâncias)
[ ] features.ts lendo FEATURE_* das envs
[ ] brand.ts lendo NEXT_PUBLIC_BRAND_* (já existe — revisar)
[ ] .env.example atualizado; .gitignore protegendo .env*
[ ] SUPABASE_ACCESS_TOKEN e token Vercel só no ambiente de operação
[ ] Provisionar 1 cliente-piloto novo SÓ com o script (validar de ponta a ponta)
```

### 🟡 Médio prazo (consolidar)

```
[ ] Adapters de pagamento (interface + Pagar.me) e catálogo (tray/manual)
[ ] Feature flags em uso real (ligar/desligar módulo por cliente)
[ ] Husky + lint-staged (tsc/lint/prettier no pre-commit)
[ ] CONTRIBUTING.md, DEPLOY.md, CHANGELOG.md criados
[ ] Monitoramento: UptimeRobot por instância + (sugerido) Sentry
[ ] Convergir os 3 clientes atuais para o repositório único (sem migrar dados)
[ ] Runner aplicando migrations em TODAS as instâncias de produção com relatório
```

### 🔵 Longo prazo (escala — quando crescer)

```
[ ] Painel super-admin via rollup/agregação das instâncias (doc 02 §10)
[ ] Onboarding self-service (formulário → script automático)
[ ] Banco de relatórios central (métricas de todas as instâncias)
[ ] Compute add-on / PITR só nos clientes que exigirem
[ ] Painel de saúde multi-instância (uptime, versão de schema por cliente)
```

---

## 4. Plano recomendado (o caminho objetivo)

### Faça primeiro (nesta ordem)

1. **Fixar o repositório único** como base e parar de copiar repo.
2. **Fundação de ambiente:** branches + 3 ambientes Vercel + instância(s) de teste.
3. **Automação (o coração do silo):**
   - `aplicar-migrations.ts` (runner) + `supabase/migrations/` numeradas.
   - `provisionar-cliente.ts` (cria Supabase + Vercel + env + domínio).
   - `instancias.json` (registro central).
4. **Feature flags por env** (`features.ts`) para as diferenças conhecidas
   (e-commerce/cadastro manual etc.).
5. **Cliente-piloto:** abrir **um** cliente novo usando **só o script** e validar
   de ponta a ponta antes de escalar.

### Deixe preparado para crescer (mas não construa agora)

- `instancias.json` já deixa o caminho pronto para o **super-admin** (agregação).
- Adapters já deixam **gateway/catálogo novos** plugáveis.
- Runner com `schema_migrations` evita drift de schema quando houver muitos bancos.

### Não complique agora (evitar over-engineering)

- ❌ **Monorepo / microserviços** — desnecessário; 1 app Next.js bem organizada
  resolve 100 clientes.
- ❌ **Banco compartilhado / `cliente_id`** — foi avaliado e descartado: traria
  risco de vazamento sem resolver nenhum problema real que o repo único já não resolva.
- ❌ **Super-admin** — importante, mas não bloqueia o início.
- ❌ **Onboarding self-service** — primeiro o script de operação; self-service depois.

### A regra que resume tudo

> **Código único, infra isolada, operação automatizada.** O repositório único
> mata a duplicação de código; o silo garante o isolamento e a segurança dos
> dados; os scripts de provisionamento/migrations tornam "muitos bancos" um
> detalhe operacional, não um peso. É a combinação que torna 100 clientes
> viáveis para uma equipe pequena **sem** abrir mão da segurança.

---

[← anterior: 04 — Padrões de Código](./04-PADROES-DE-CODIGO.md) · [voltar ao índice](./README.md)
