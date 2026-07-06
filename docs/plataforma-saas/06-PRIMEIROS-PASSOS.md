# 06 — Primeiros Passos (guia para executar com a Claude)

[← voltar ao índice](./README.md)

> **Para quem é este doc:** a responsável pelo produto, executando junto com a
> Claude dela. Cada fase tem **objetivo**, **passos** e um bloco *"como pedir pra
> Claude"* — uma instrução pronta pra colar no Claude Code.

---

## ⚠️ Regra de ouro deste início

> **NÃO mexer nos 3 clientes/repositórios atuais.** Eles continuam em produção,
> exatamente como estão. **Tudo aqui é feito do zero**, num **repositório novo**
> e num **cliente-teste novo**. Só depois que a nova base estiver validada é que
> pensamos em convergir os antigos — e isso é assunto para o futuro, não para agora.

Por que assim: o objetivo é **validar a nova arquitetura** (1 repo + silo +
scripts) sem nenhum risco para quem já está rodando e faturando.

---

## Visão geral das fases

```
Fase 0  Preparar o repositório novo (a base de código única)
Fase 1  Organizar migrations + tabela de controle
Fase 2  Runner de migrations (aplica em qualquer banco)
Fase 3  Script de provisionamento (cria a stack de um cliente)
Fase 4  Feature flags por ambiente
Fase 5  Provisionar o CLIENTE-TESTE e validar de ponta a ponta
```

Faça **uma fase por vez**. Só passe para a próxima quando a anterior estiver
funcionando. Não tente fazer tudo de uma vez.

---

## Fase 0 — Repositório novo (a base única)

**Objetivo:** ter um repositório limpo que será a base de **todos** os próximos
clientes. Pode ser uma cópia do repo atual como ponto de partida — mas a partir
daqui ele vira o **único** que recebe melhorias.

**Passos:**
1. Criar um repositório novo no GitHub (ex.: `plataforma-prata`).
2. Levar para ele o código atual como base inicial.
3. Criar as branches `dev`, `test`, `production` e **proteger** a `production`
   (exigir Pull Request).
4. Conferir que `.gitignore` ignora `.env*` (exceto `.env.example`).
5. Criar/atualizar o `.env.example` com todas as chaves **sem valores reais**.

**Como pedir pra Claude:**
```
Estou começando um repositório novo que será a base única da plataforma.
NÃO altere nenhum dos 3 repositórios de clientes existentes.
1. Crie as branches dev, test e production.
2. Revise o .gitignore e garanta que ignora .env* exceto .env.example.
3. Gere um .env.example completo (sem valores reais) com todas as variáveis
   que o projeto usa hoje, agrupadas por categoria (Supabase, marca, Pagar.me,
   Resend, Correios, feature flags). Explique cada uma em comentário.
```

---

## Fase 1 — Migrations organizadas + tabela de controle

**Objetivo:** transformar os SQLs soltos em `supabase/` numa sequência
**numerada e versionada**, e criar a tabela que registra o que já foi aplicado.

**Passos:**
1. Criar a pasta `supabase/migrations/`.
2. Mover os SQLs atuais para lá, **renomeando com prefixo de data/ordem**
   (ex.: `20260701_120000_revendedoras.sql`), na ordem correta de dependência.
3. Garantir que cada migration é **idempotente** (`create table if not exists`,
   `add column if not exists`).
4. Criar a migration da tabela de controle:

```sql
-- supabase/migrations/00000000_000000_schema_migrations.sql
create table if not exists public.schema_migrations (
  versao      text primary key,
  aplicada_em timestamptz not null default now()
);
```

**Como pedir pra Claude:**
```
Organize as migrations do projeto:
1. Crie supabase/migrations/ e mova os arquivos de supabase/*.sql para lá,
   renomeando com prefixo de timestamp na ordem correta de dependência
   (revendedoras antes de comissoes, etc.).
2. Garanta que cada uma é idempotente.
3. Crie a migration da tabela schema_migrations (versao text PK, aplicada_em).
Liste a ordem final das migrations e justifique a ordem.
```

> Não edite migrations já aplicadas em produção dos clientes antigos — aqui é
> repositório novo, então pode reorganizar livremente.

---

## Fase 2 — Runner de migrations

**Objetivo:** um script que aplica as migrations pendentes em **qualquer** banco
(começando pelo de teste), registrando cada uma em `schema_migrations`.

**Passos:**
1. Criar `scripts/aplicar-migrations.ts`.
2. Ele deve: ler `supabase/migrations/` em ordem → para o banco alvo, ver o que
   já está em `schema_migrations` → aplicar só o que falta via **Supabase
   Management API** (`SUPABASE_ACCESS_TOKEN`) → registrar cada aplicada.
3. Suportar rodar em **um** banco (`--ref <supabase_ref>`).
4. Reportar sucesso/falha de forma clara.

**Como pedir pra Claude:**
```
Crie scripts/aplicar-migrations.ts (Node/TypeScript).
- Lê supabase/migrations/ em ordem alfabética (timestamp).
- Recebe --ref <supabase_project_ref> do banco alvo.
- Usa a Supabase Management API com SUPABASE_ACCESS_TOKEN para:
  garantir a tabela schema_migrations, descobrir migrations já aplicadas,
  aplicar em ordem só as pendentes e registrar cada uma.
- Loga cada migration aplicada e um resumo no final.
- É seguro rodar de novo (idempotente): não reaplica o que já está registrado.
Documente como rodar no topo do arquivo.
```

> **Teste primeiro num Supabase de teste**, nunca num banco de cliente real.

---

## Fase 3 — Script de provisionamento de cliente

**Objetivo:** um comando que cria a **stack inteira** de um cliente novo:
Supabase + migrations + projeto Vercel + variáveis de ambiente + domínio.

**Passos:**
1. Criar `scripts/instancias.json` (registro central — só referências, sem segredos).
2. Criar `scripts/provisionar-cliente.ts` que:
   - cria o projeto Supabase (Management API, região São Paulo);
   - roda o runner da Fase 2 no banco novo;
   - cria o projeto Vercel apontando para o **mesmo repositório**;
   - seta as variáveis de ambiente daquele cliente;
   - aponta o subdomínio;
   - adiciona o cliente ao `instancias.json`;
   - imprime um relatório com o que ficou pendente de fazer à mão (recipients
     Pagar.me, verificar domínio no Resend).

**Como pedir pra Claude:**
```
Crie scripts/provisionar-cliente.ts que recebe --slug e --nome e:
1. Cria um projeto Supabase novo (Management API, região São Paulo).
2. Roda scripts/aplicar-migrations.ts no banco novo.
3. Cria um projeto Vercel ligado a ESTE repositório (production branch = production),
   usando a API da Vercel.
4. Configura as variáveis de ambiente do cliente (peça quais valores faltam).
5. Aponta o subdomínio <slug>.lojadeprata925.com.br.
6. Registra o cliente em scripts/instancias.json (só referências, sem segredos).
7. No final, imprime um checklist do que ainda precisa ser feito manualmente.
Comece imprimindo um "plano de execução" e peça minha confirmação antes de criar
qualquer recurso pago.
```

> **Segurança:** `SUPABASE_ACCESS_TOKEN` e o token da Vercel são poderosos. Use só
> na máquina de operação, nunca commite, nunca coloque no app.

---

## Fase 4 — Feature flags por ambiente

**Objetivo:** ligar/desligar módulos por cliente via variável de ambiente, sem
`if (cliente === 'x')` no código.

**Passos:**
1. Criar/centralizar `src/lib/features.ts` lendo `FEATURE_*` das envs.
2. Usar a flag para esconder na UI **e** bloquear no route handler.
3. Documentar cada flag no `.env.example`.

**Como pedir pra Claude:**
```
Crie src/lib/features.ts que lê as flags FEATURE_* do ambiente (ex.:
FEATURE_ECOMMERCE, FEATURE_WHATSAPP, FEATURE_RELATORIO) e exporta um objeto
tipado. Mostre um exemplo de uso escondendo um módulo na UI e bloqueando o
endpoint correspondente quando a flag estiver desligada. Adicione as flags ao
.env.example com comentário.
```

---

## Fase 5 — Cliente-teste de ponta a ponta

**Objetivo:** provar que tudo funciona criando **um cliente-teste** só com o
script, e validando o fluxo real.

**Passos:**
1. Rodar `scripts/provisionar-cliente.ts --slug teste --nome "Cliente Teste"`.
2. Conferir: subdomínio abre, marca correta, banco com as tabelas, login de
   revendedora funciona.
3. Fazer um **pedido de teste pequeno** (R$5–30) em aba anônima.
4. Conferir pedido no admin, e-mail enviado, split no gateway.
5. Ligar/desligar uma feature flag e confirmar o efeito.
6. Rodar o runner com uma migration nova e confirmar que aplica no banco-teste.

**Como pedir pra Claude:**
```
Vamos validar o cliente-teste recém-provisionado. Me guie por um roteiro de
testes manuais cobrindo: abrir o subdomínio, login de revendedora, um pedido de
teste de ponta a ponta, conferência de e-mail e split, e o efeito de uma feature
flag. Liste cada passo e o resultado esperado.
```

---

## Definição de "pronto" (quando esta etapa está concluída)

```
[ ] Repositório novo criado, com dev/test/production e production protegida
[ ] supabase/migrations/ numeradas + schema_migrations
[ ] aplicar-migrations.ts funcionando num banco de teste
[ ] provisionar-cliente.ts criando a stack completa de um cliente
[ ] features.ts ligando/desligando módulo por env (UI + endpoint)
[ ] Cliente-teste provisionado SÓ pelo script e validado de ponta a ponta
[ ] Nenhum dos 3 clientes atuais foi tocado
```

Concluída esta etapa, a base nova está provada. A partir daí, cada cliente novo
nasce direto nela. A convergência dos 3 antigos fica para depois (doc 02 §11) —
sem pressa e sem risco.

---

[← anterior: 05 — Escalabilidade, Riscos e Plano](./05-ESCALABILIDADE-RISCOS-PLANO.md) · [voltar ao índice](./README.md)
