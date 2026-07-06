# 02 — Banco de Dados e Supabase (modelo silo)

[← voltar ao índice](./README.md)

> **Decisão:** **banco isolado por cliente** (silo). Cada cliente tem o seu
> projeto Supabase. O isolamento entre clientes é **físico**, não depende de RLS.
> O desafio do silo é **operacional** (gerenciar muitos bancos) — e a resposta
> para isso é **automação**, o tema central deste documento.

---

## 1. A estratégia escolhida (e por que, em comparação)

**Escolhido: um projeto Supabase por cliente ("silo").**

| Estratégia | Isolamento entre clientes | Custo / operação | Veredito |
|---|---|---|---|
| **Projeto por cliente** (silo) | **Máximo (físico)** | N projetos, migrations ×N | ✅ **Escolhido** — risco de vazamento ~zero; resolve-se a operação com automação |
| **Schema por cliente** (bridge) | Forte (lógico) | 1 projeto, atrito com PostgREST | Descartado por complexidade |
| **Compartilhado + `cliente_id`** (pool) | Lógico (depende de RLS) | 1 projeto, 1 migration | Descartado: um RLS errado vaza **todos** os clientes |

> Trade-off aceito: trocamos simplicidade operacional por **isolamento e
> segurança**. Para B2B com dados financeiros e CPF, é a troca certa. O custo
> operacional (muitos bancos) é mitigado com os scripts das seções 3 e 4.

---

## 2. Modelo de dados (dentro do banco de UM cliente)

Cada banco contém **apenas os dados daquele cliente**. **Não existe** tabela
`clientes` nem coluna `cliente_id` — o banco inteiro já pertence a um cliente.

```
auth.users (1) ──1 revendedoras (N)
revendedoras (1) ──< pedidos / comissoes / saques / notificacoes (N)
produtos (catálogo do cliente)
```

### 2.1 Tabelas principais

São as que já existem ([`supabase/`](../../supabase/)): `revendedoras`,
`produtos`, `pedidos`, `comissoes`, `saques`, `mensalidades`, `notificacoes`,
`pedidos_historico`, etc. **O schema continua o mesmo** — a novidade é como ele
é **provisionado e versionado** em muitos bancos (seções 3 e 4).

### 2.2 Índices

Manter os índices por revendedora e por status que já existem (ex.:
`idx_comissoes_revendedora_id`, `idx_pedidos_status`). Como cada banco tem só um
cliente (~300 revendedoras), o volume por banco é pequeno e os índices atuais
já dão conta.

---

## 3. RLS — isolar revendedoras DENTRO do banco

No silo, o RLS **não** protege cliente × cliente (isso é a infra). Ele protege
**revendedora × revendedora** dentro do banco do cliente — papel que já cumpre hoje.

```sql
alter table public.comissoes enable row level security;

-- service_role (APIs server-side): acesso total
create policy "service_role_full" on public.comissoes
  for all to service_role using (true) with check (true);

-- (se houver acesso direto do client autenticado) revendedora só vê o que é dela
create policy "rev_select_proprias" on public.comissoes
  for select to authenticated
  using (revendedora_id = (select id from public.revendedoras where user_id = auth.uid()));
```

> O padrão atual já usa `service_role` no servidor + policies por revendedora.
> **Manter.** O ponto de atenção do silo não é RLS — é não vazar **credenciais**
> entre instâncias (seção 7).

---

## 4. Provisionamento automatizado (a peça-chave do silo)

Hoje, abrir um cliente é um **checklist manual** (ver [`../WHITE_LABEL.md`](../WHITE_LABEL.md)):
criar Supabase, rodar migrations, criar projeto Vercel, setar envs, apontar
domínio. Com 1–3 clientes funciona; com 100, **tem que ser script**.

### 4.1 O que o script `provisionar-cliente.ts` faz

```
scripts/provisionar-cliente.ts  --slug lunara --nome "Lunara Joias"
```

1. **Cria o projeto Supabase** via Management API
   (`POST /v1/projects`, região São Paulo).
2. **Roda todas as migrations** de `supabase/migrations/` no projeto novo
   (reusa o runner da seção 5).
3. **Cria o projeto Vercel** via Vercel API, apontando para o **mesmo repositório**
   GitHub, com production branch = `main`.
4. **Seta as variáveis de ambiente** no Vercel (marca, Supabase keys, Pagar.me,
   Resend, Correios, feature flags) — escopadas em Production/Preview.
5. **Aponta o domínio/subdomínio** do cliente para o projeto Vercel.
6. **Imprime um relatório** com o que foi criado e o que ainda precisa ser feito
   à mão (ex.: verificar domínio no Resend, cadastrar recipients Pagar.me).

> Resultado: abrir um cliente vira **um comando** + alguns passos manuais
> irredutíveis (KYC/recipients), em vez de uma hora de cliques.

### 4.2 APIs usadas

| Recurso | API | Auth |
|---|---|---|
| Criar/gerir projeto Supabase | [Management API](https://supabase.com/docs/reference/api) | `SUPABASE_ACCESS_TOKEN` |
| Rodar SQL/migrations | Management API (`/database/query`) | idem |
| Criar projeto/env/domínio Vercel | [Vercel REST API](https://vercel.com/docs/rest-api) | token Vercel |

> Já existe `SUPABASE_ACCESS_TOKEN` em uso no projeto (ver `CLAUDE.md`). É a base
> para automatizar tudo.

### 4.3 Registro central de instâncias

Manter um arquivo/tabela com o catálogo de clientes provisionados — necessário
para o runner de migrations e para o futuro super-admin:

```jsonc
// scripts/instancias.json  (ou uma tabela num "banco de controle" pequeno)
[
  { "slug": "prata925", "supabaseRef": "ipovxwzzqjjywratrbjx", "vercel": "revendedoraspratade15reais", "dominio": "lojadeprata925.com.br" },
  { "slug": "lunara",   "supabaseRef": "xxxx", "vercel": "lunara", "dominio": "lunarajoias.com.br" }
]
```

> ⚠️ Esse arquivo guarda **referências**, não segredos. Chaves ficam só na Vercel
> de cada projeto. Se preferir, use um "banco de controle" Supabase separado
> (não é dado de cliente — é metadado operacional).

---

## 5. Migrations em muitos bancos (runner)

O ponto mais sensível do silo: uma mudança de schema precisa chegar em **todos**
os bancos. Hoje é manual (um por um). A solução é um **runner**.

### 5.1 Como estruturar

```
supabase/migrations/
  20260701_120000_add_codigo_rastreio.sql
  20260702_093000_add_pix_split.sql
```

- Migrations **numeradas por timestamp** e **imutáveis** (nunca editar uma já
  aplicada — criar outra).
- Cada migration é **idempotente** (`create ... if not exists`, `add column if not exists`).

### 5.2 O runner `aplicar-migrations.ts`

```
scripts/aplicar-migrations.ts            # aplica pendentes em TODAS as instâncias
scripts/aplicar-migrations.ts --slug lunara   # só em uma
scripts/aplicar-migrations.ts --env test      # só nos bancos de teste
```

Para cada instância (lendo `instancias.json`):

1. Garante uma tabela de controle `schema_migrations (versao text primary key, aplicada_em timestamptz)`.
2. Lê quais migrations já foram aplicadas.
3. Aplica, **em ordem**, as que faltam, via Management API.
4. Registra cada uma em `schema_migrations`.
5. Reporta sucesso/falha por instância (não para tudo se uma falhar — reporta e segue).

> Isso transforma "rodar SQL em 100 bancos" em **um comando**. É o que torna o
> silo sustentável. **Investir nisso cedo** — antes de passar de ~5 clientes.

### 5.3 Boas práticas de migration

- **Retrocompatível**: adicionar antes de remover, para o código antigo não
  quebrar durante o deploy.
- **Testar em `dev`/`test`** antes de produção (ver doc 03).
- Coluna `NOT NULL` em tabela com dados: adicionar nullable → backfill → setar `NOT NULL`.

---

## 6. Domínios

- Cada cliente tem **seu** domínio/subdomínio apontado para **seu** projeto Vercel.
- Hoje o padrão é **subdomínio** (`cliente.lojadeprata925.com.br`) — confirmado
  pela responsável.
- O passo de apontar o domínio entra no script de provisionamento (Vercel API).
- Domínio próprio do cliente (`lunarajoias.com.br`) é suportado como **opção**
  (passo manual adicional / premium).

---

## 7. Segredos e credenciais (cuidado nº 1 do silo)

Como cada cliente tem suas próprias chaves, o risco aqui **não** é vazamento de
dados entre bancos (impossível) — é **reaproveitar/expor credenciais**:

- Cada projeto Vercel com **suas** envs (`PAGARME_*`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
- **Nunca** colocar segredo em `NEXT_PUBLIC_*` (vaza pro navegador).
- O script de provisionamento **não** deve copiar a chave de um cliente para outro.
- Se um segredo vazar, **rotacionar** no provedor (trocar a chave), não só remover do Git.
- `SUPABASE_ACCESS_TOKEN` (Management API) é **muito poderoso** — guardar com
  cuidado; só em ambiente de operação/CI, nunca no client.

---

## 8. Backups, logs e rastreabilidade

- **Backups:** cada Supabase tem o seu. Vantagem do silo: **restaurar 1 cliente
  não afeta os outros** (no pool seria tudo-ou-nada). PITR por add-on, por projeto.
- **Logs:** Logs Explorer do Supabase (por projeto) + logs da Vercel (por projeto).
- **Rastreabilidade:** manter `admin_audit_log` (já existe) em cada banco para
  ações sensíveis (mudar status, liberar comissão).

---

## 9. Quando o plano do Supabase não bastar

No silo, a conta cresce **por projeto**. Sinais e ações:

| Sinal | O que fazer |
|---|---|
| Cliente novo em produção | Subir aquele projeto para **Pro** (free tier pausa por inatividade) |
| Conexões esgotando em serverless | **Connection Pooler / Supavisor** (modo transaction) em cada projeto |
| Custo total de N projetos Pro pesando | Avaliar org billing; lembrar que é **COGS de clientes pagantes** |
| CPU/RAM alto num cliente específico | **Compute add-on** só naquele projeto (vantagem do silo: isola o custo) |
| Contrato exige PITR | Add-on de PITR naquele projeto |

> Regra prática: **Pro por cliente assim que ele entra em produção.** Em silo, um
> cliente pesado é facilmente tratável (sobe só o plano dele), sem afetar os outros.

---

## 10. Super-admin no silo (futuro)

No banco compartilhado, super-admin seria uma query. No silo, os dados estão em
N bancos — então a visão consolidada precisa **agregar**. Abordagens (escolher na
hora, não agora):

1. **Agregação sob demanda:** o painel consulta a API de cada instância e soma.
   Simples, mas mais lento com muitos clientes.
2. **Data warehouse / rollup:** um job periódico copia métricas-chave (vendas,
   nº de revendedoras) de cada banco para um banco de relatórios central.
   Recomendado a partir de ~20 clientes.

> O `instancias.json` (seção 4.3) já é o ponto de partida: ele lista onde estão
> todos os bancos para o agregador percorrer.

---

## 11. Os 3 clientes atuais

**Já são silo.** Não há migração de banco a fazer — esse é um ganho de termos
escolhido manter o isolamento. O único trabalho futuro é alinhá-los ao
**repositório único** (hoje são repos copiados) conforme forem recebendo
atualizações. Sem urgência e sem risco de mexer nos dados.

---

[← anterior: 01 — Arquitetura](./01-ARQUITETURA-E-REPOSITORIO.md) · [próximo: 03 — Ambientes, Branches e Deploy →](./03-AMBIENTES-BRANCHES-DEPLOY.md)
