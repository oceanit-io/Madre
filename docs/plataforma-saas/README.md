# Plataforma SaaS Multi-Cliente — Plano de Arquitetura

> **Status:** plano aprovado para os **próximos** clientes (e que descreve o que
> os 3 atuais já fazem).
> **Decisão central:** 1 repositório (código único) + **banco isolado por
> cliente** (modelo "silo") + **provisionamento automatizado**.
> **Horizonte:** preparar para ~100 clientes × ~300 revendedoras cada.
> **Última atualização:** 2026-06-29.

Este conjunto de documentos é o **guia oficial** para construir e operar a
plataforma. Serve para duas audiências:

1. **Pessoa** (a responsável pelo produto) — entender o porquê de cada decisão e
   seguir os checklists.
2. **IA (Claude)** — usar como briefing técnico para executar as etapas de
   implementação com contexto suficiente.

---

## ✅ Relação com a análise anterior

Este plano **confirma e operacionaliza** a recomendação do documento
[`../ARQUITETURA_MULTICLIENTE.md`](../ARQUITETURA_MULTICLIENTE.md) (22/06/2026):
manter o **isolamento por cliente** e resolver a duplicação de código com **1
repositório + feature flags**.

O que este plano **adiciona**: o detalhamento operacional que faltava —
**automação de provisionamento** (criar Supabase + Vercel + env de um cliente
novo via script, em vez de checklist manual), padrões de código, ambientes e
escalabilidade. Também se alinha ao [`../WHITE_LABEL.md`](../WHITE_LABEL.md), que
já descreve o modelo white-label por variável de ambiente em uso hoje.

---

## 📚 Índice

| # | Documento | O que cobre |
|---|---|---|
| 1 | [01-ARQUITETURA-E-REPOSITORIO.md](./01-ARQUITETURA-E-REPOSITORIO.md) | Resumo da arquitetura, estrutura de pastas, separação global × cliente, feature flags, autenticação e permissões |
| 2 | [02-BANCO-E-SUPABASE.md](./02-BANCO-E-SUPABASE.md) | Modelo isolado por cliente, RLS (nível revendedora), **provisionamento automatizado**, runner de migrations, backups, planos |
| 3 | [03-AMBIENTES-BRANCHES-DEPLOY.md](./03-AMBIENTES-BRANCHES-DEPLOY.md) | Branches, ambientes (dev/test/prod), variáveis de ambiente, deploy, rollback |
| 4 | [04-PADROES-DE-CODIGO.md](./04-PADROES-DE-CODIGO.md) | Padrões de código, nomenclatura, tratamento de erros, tooling, documentação interna |
| 5 | [05-ESCALABILIDADE-RISCOS-PLANO.md](./05-ESCALABILIDADE-RISCOS-PLANO.md) | Escalabilidade, gargalos, monitoramento, riscos, checklist de implantação, plano recomendado |
| 6 | [06-PRIMEIROS-PASSOS.md](./06-PRIMEIROS-PASSOS.md) | **Guia prático passo a passo** para executar com a Claude — repo novo + cliente-teste, sem tocar nos 3 atuais |

---

## 🧭 Resumo executivo (leia isto primeiro)

### A decisão em uma frase

> **Um código, infraestruturas isoladas.** O repositório é **único** (um fix vale
> pra todos). Mas cada cliente (empresa de prata) tem a **sua própria stack
> isolada**: seu projeto Vercel, seu Supabase, seu domínio, suas credenciais.
> Criar um cliente novo é rodar um **script de provisionamento**, não copiar repo.

### Por que silo (e não banco compartilhado)

Para um negócio **B2B** onde cada cliente é uma empresa pagante com dados
financeiros (vendas, splits) e pessoais (CPF), o isolamento físico é uma
**vantagem**, não um custo:

- **Vazamento entre clientes é impossível** — bancos fisicamente separados. Não
  depende de um RLS perfeito.
- **"Seus dados ficam só com você"** — argumento comercial real.
- **Já está construído** — o código já é white-label por env (ver `WHITE_LABEL.md`).
- **Cliente pesado não afeta os outros** — sem "vizinho barulhento".

O preço do silo é **operacional** (N projetos pra gerenciar, migrations rodando
em cada um). Esse preço é **pago com automação** — o foco do doc 02.

### Os dois níveis de "tenant" (não confundir)

```
Plataforma (1 repositório de código)
  │
  ├── Cliente A  →  Vercel A + Supabase A + domínio A   ← stack isolada (silo)
  │     └── Revendedora 1, 2, 3...  (/loja/[slug])      ← multi-tenant DENTRO do cliente (RLS)
  │
  ├── Cliente B  →  Vercel B + Supabase B + domínio B
  │     └── Revendedora ...
  │
  └── Cliente C  →  ...
```

- **Nível cliente (B2B):** isolado por **infraestrutura** (silo).
- **Nível revendedora (B2C):** isolado por **RLS** dentro do banco do cliente —
  isso **já existe e funciona** (`/loja/[slug]`).

### O que muda em relação a hoje

| Hoje (3 clientes) | Plano (próximos clientes) |
|---|---|
| Repo **copiado** por cliente (divergem com o tempo) | **1 repo único** pra todos (sem divergência) |
| 1 Supabase por cliente | **Mantém** 1 Supabase por cliente ✅ |
| Provisionamento manual (checklist `WHITE_LABEL.md`) | **Script automatizado** (Supabase + Vercel + env) |
| Migration aplicada à mão em cada banco | **Runner** que aplica em todos os projetos |
| Diferença de cliente = código copiado | Diferença = **feature flag** (env) ou **adapter** |

### O que NÃO muda

- **Os 3 clientes atuais ficam como estão.** Eles **já são silo** — não há
  migração de banco a fazer. Eles só passam a apontar para o repositório único
  conforme forem atualizados (sem pressa).
- A lógica de negócio (split Pagar.me, frete Correios, sync Tray) continua igual.

### As 6 decisões já tomadas

| Decisão | Escolha | Onde está detalhado |
|---|---|---|
| Estrutura de repositório | **1 repo único** (deployado N vezes) | doc 1 |
| Banco de dados | **Isolado por cliente** (silo); RLS para revendedoras | doc 2 |
| Provisionamento | **Automatizado** (Supabase + Vercel + env via script) | doc 2 |
| Config por cliente | Feature flags + credenciais por **variável de ambiente** | doc 1 e 3 |
| Ambientes | 3 (dev / test / produção) na Vercel | doc 3 |
| Pagamento / catálogo | Padrão Adapter (gateway e fonte plugáveis) | doc 1 |

### Decisão deixada para o futuro (não fazer agora)

- **Painel super-admin** (visão de todos os clientes). No silo isso exige
  **agregar dados de N bancos** — mais trabalhoso. Abordagem sugerida no doc 2.
  Não bloqueia o início.

---

## 🚦 Por onde começar a executar

> **Importante:** o início é feito num **repositório novo** e num **cliente-teste
> novo**. Os **3 clientes atuais não são tocados agora** — a convergência deles
> fica para o futuro (doc 02 §11).

1. Ler este README inteiro.
2. Ler [02-BANCO-E-SUPABASE.md](./02-BANCO-E-SUPABASE.md) — onde está o **provisionamento
   automatizado**, que é a peça que torna o silo viável em escala.
3. Executar o guia prático [06-PRIMEIROS-PASSOS.md](./06-PRIMEIROS-PASSOS.md) —
   passo a passo, fase por fase, pronto para seguir junto com a Claude.
4. Consultar o **Checklist de implantação** em [05-ESCALABILIDADE-RISCOS-PLANO.md](./05-ESCALABILIDADE-RISCOS-PLANO.md)
   para a visão de curto / médio / longo prazo.
