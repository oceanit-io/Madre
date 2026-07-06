# Database

Schema, migrations e tabelas principais.

## 🗄️ Provedor

**Supabase Postgres**. Project ref: ver `.env.local`.

Acesso:
- **App** (runtime): cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Admin** (one-off): SQL Editor do dashboard OU Management API com `SUPABASE_ACCESS_TOKEN`.

## 📁 Migrations

Não usamos ferramenta de migração automática. Cada arquivo em `supabase/*.sql` é uma alteração aplicada **uma vez** (ou idempotente — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Ordem completa
A **lista ordenada e completa** (schema base `supabase-schema.sql` + os 32 `supabase/*.sql`) está em
**[SETUP.md → Aplicar migrations](./SETUP.md#3-aplicar-migrations)**. Começa pelo `supabase-schema.sql` (raiz).

Migrations importantes adicionadas depois da v1:
```
mensalidade_auto_ativacao.sql -- trigger de vencimento + RPC registrar_pagamento_mensalidade
                                 (ativação/renovação automática ao pagar)
codigo_rastreio.sql           -- coluna codigo_rastreio em pedidos
pix_split.sql                 -- ajustes do split PIX
blocos_loja.sql               -- mostrar_bloco_* (prata925/depoimentos/garantias)
hero_texto_editavel.sql       -- hero_titulo / hero_subtitulo editáveis
whatsapp_mensagem.sql         -- whatsapp_mensagem (mensagem pré-preenchida)
admin_alertas.sql             -- tabela admin_alertas (avisos do painel)
admin_audit_log.sql           -- tabela admin_audit_log (quem fez o quê)
aceite_lgpd.sql               -- aceitou_termos_em (consentimento LGPD)
security_hardening.sql        -- endurecimento de segurança
security_fixes.sql            -- auditoria jun/2026: revoga RPC pública, RLS nas tabelas admin
```

### Aplicar uma migration

#### Via SQL Editor (dashboard)
1. Supabase dashboard → SQL Editor → New query.
2. Cola o conteúdo do arquivo.
3. Run.

#### Via Management API (bash)
```bash
TOKEN="$SUPABASE_ACCESS_TOKEN"
REF="ipovxwzzqjjywratrbjx"  # ou o teu
SQL=$(cat supabase/nova-migration.sql)

curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw "$(jq -n --arg q "$SQL" '{query:$q}')"
```

### Criar nova migration

1. Cria arquivo `supabase/feature-x.sql` com SQL idempotente:
   ```sql
   -- ============================================================
   -- Feature X: <descrição>
   -- ============================================================
   alter table public.minha_tabela
     add column if not exists nova_coluna text;

   create index if not exists idx_minha_tabela_nova_coluna
     on public.minha_tabela (nova_coluna)
     where nova_coluna is not null;
   ```
2. Aplica via Management API.
3. Commita.

---

## 📊 Tabelas principais

### `revendedoras`
Uma linha por loja/usuária.

```sql
create table revendedoras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),  -- linka Supabase Auth
  nome text not null,
  nome_loja text,
  email text not null,
  whatsapp text not null,
  cidade text not null,
  estado text not null,
  subdominio text unique not null,
  status text not null check (status in ('pendente', 'ativa', 'suspensa')),
  saldo_disponivel numeric(10,2) default 0,
  saldo_processando numeric(10,2) default 0,
  total_ganho numeric(10,2) default 0,
  total_vendas integer default 0,
  mensalidade_vence_em date,
  mensalidade_isento boolean default false,
  -- Personalização (todos opcionais)
  cor_tema text,
  fonte text,
  cor_fundo text,
  banner_preset text,
  banner_url text,
  video_url text,
  cinta_cor text,
  hero_texto_cor text,
  mostrar_hero_texto boolean default true,
  banner_overlay boolean default true,
  foto_url text,
  bio text,
  instagram text,
  tiktok text,
  -- Recebedor Pagar.me
  pagarme_recipient_id text,
  pagarme_recipient_status text,
  pagarme_recipient_data jsonb,
  -- Asaas (legado, sem uso atual)
  asaas_customer_id text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
```

**Índices**:
- `subdominio` (unique).
- `user_id` (unique).
- `pagarme_recipient_id` (where not null) — pro webhook achar pelo ID.

### `produtos`
Catálogo sincronizado da Tray.

```sql
create table produtos (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,  -- = id da Tray
  nome text not null,
  descricao text,
  categoria text,         -- categoria pai derivada do slug
  subcategoria text,      -- subcategoria (2º segmento do slug)
  preco numeric(10,2) not null,
  preco_promo numeric(10,2),
  peso_g integer,
  estoque integer default 0,
  fotos text[],
  marca text,
  modelo text,
  referencia text,        -- scraping HTML
  ean text,
  tamanho text,
  cor text,
  destaque boolean default false,         -- curado manual
  destaque_tray boolean default false,    -- do hot da Tray
  lancamento boolean default false,
  ativo boolean default true,
  has_variation boolean default false,
  variacoes_cache jsonb,
  atualizado_em timestamptz default now()
);
```

**Sync**: `lib/traySync.ts`. Preserva `destaque` (curado manual) e `referencia` (scraping lazy).

### `pedidos`
Checkout guest (sem `user_id`).

```sql
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text unique not null,  -- PED-AAAAMMDD-NNNN
  status text not null default 'aguardando_pagamento',
  cliente_nome text not null,
  cliente_email text not null,
  cliente_cpf text not null,
  cliente_telefone text not null,
  endereco_cep text not null,
  endereco_rua text not null,
  endereco_numero text not null,
  endereco_complemento text,
  endereco_bairro text not null,
  endereco_cidade text not null,
  endereco_uf text not null check (char_length(endereco_uf) = 2),
  itens jsonb not null,  -- snapshot dos itens
  subtotal numeric(10,2) not null,
  frete numeric(10,2) not null,
  total numeric(10,2) not null,
  regiao_frete text check (regiao_frete in ('sudeste', 'sul', 'nordeste', 'norte_centro_oeste')),
  slug_revendedora text,
  pagbank_link text,     -- legado: usado pra qualquer link de pagamento (PagBank ou Pagar.me)
  pagbank_pago boolean default false,
  observacoes text,
  data_envio timestamptz,
  codigo_rastreio text,
  criado_em timestamptz default now()
);
```

**Status**:
- `aguardando_pagamento` — pedido criado.
- `pago` — webhook confirmou.
- `enviado` — admin marcou (manual).
- `entregue`.
- `cancelado`.

**Trigger**: ao mudar de qualquer pra `pago`, cria linha em `comissoes`.

### `comissoes`
Gerada por trigger.

```sql
create table comissoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id),
  revendedora_id uuid references revendedoras(id),
  slug_revendedora text,  -- fallback se revendedora_id ainda não resolvido
  numero_pedido text,
  cliente_nome text,
  valor_base numeric(10,2) not null,
  percentual numeric(5,2) not null default 30.00,
  valor_comissao numeric(10,2) not null,  -- valor_base * percentual / 100
  status text not null default 'processando',
  data_liberacao date,  -- 20 dias após criado
  data_pagamento date,
  created_at timestamptz default now()
);
```

**Status comissão**:
- `processando` — 20 dias de "análise" (período de chargeback).
- `liberada` — saldo disponível pra saque.
- `paga` — saque concluído.
- `cancelada` — se pedido for cancelado.

**Trigger de saldo**:
- Ao virar `processando`: `saldo_processando += valor`.
- Ao virar `liberada`: `saldo_processando -= valor`, `saldo_disponivel += valor`.
- Ao virar `paga`: `saldo_disponivel -= valor`.

### `saques`
Solicitações de saque.

```sql
create table saques (
  id uuid primary key default gen_random_uuid(),
  revendedora_id uuid references revendedoras(id),
  tipo text not null check (tipo in ('pix', 'credito_loja')),
  valor numeric(10,2) not null,
  chave_pix text,
  status text not null default 'solicitado'
    check (status in ('solicitado', 'processando', 'pago', 'recusado')),
  criado_em timestamptz default now(),
  pago_em timestamptz
);
```

Saque é manual hoje (admin processa fora do sistema e marca como pago).

### `mensalidades`
Controle mensal R$39,99 por revendedora.

```sql
create table mensalidades (
  id uuid primary key default gen_random_uuid(),
  revendedora_id uuid references revendedoras(id),
  competencia date not null,  -- mês de referência (1º do mês)
  valor numeric(10,2) not null default 39.99,
  status text not null default 'pendente',
  pago_em timestamptz,
  observacoes text,
  unique (revendedora_id, competencia)
);
```

### `notificacoes`
Feed da revendedora.

```sql
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  revendedora_id uuid references revendedoras(id),
  titulo text not null,
  mensagem text,
  tipo text,  -- 'nova_venda', 'saque_aprovado', 'aviso', etc.
  lida boolean default false,
  criado_em timestamptz default now()
);
```

### `sync_estado`
Última execução do sync Tray.

```sql
create table sync_estado (
  chave text primary key,
  valor jsonb,
  atualizado_em timestamptz
);

-- Linha única: 'tray'
-- valor: { total, upserted, categorias, erros, em, descricoes }
```

### Outras tabelas
- `mensalidades_pagamentos` — histórico de pagamentos/renovações da mensalidade (`valor`, `metodo`, `vence_novo`, `provider_tx` pra idempotência do webhook).
- `visitas` — tracking anônimo (`pagina`, `sessao`, `referrer`, `user_agent_short`, `criado_em`). O storefront grava `pagina = 'loja/<slug>'` → conta visitas por loja (dashboard da revendedora) e funil landing/cadastro (admin).
- `admin_alertas` — avisos do painel admin. **RLS ON** (só service_role).
- `admin_audit_log` — log de ações admin (quem fez o quê). **RLS ON** (só service_role).
- `pedidos_historico` — transições de status dos pedidos.

---

## 🔒 Row-Level Security (RLS)

Habilitado em tabelas sensíveis. Default: nega tudo, exceto policies explícitas.

### `pedidos`
- Anon: pode INSERT (guest checkout). Cálculo de subtotal/frete/total SEMPRE no server com service_role.
- Service role: acesso total.

### `revendedoras`
- Authenticated: SELECT do próprio user_id.
- Service role: acesso total.

### `comissoes`
- Apenas service_role. UI vai via API (`/api/revendedora/financeiro`).

### `produtos`
- Anon: SELECT em `ativo = true`.
- Service role: acesso total.

### `saques`, `mensalidades`, `notificacoes`
- Authenticated: SELECT do próprio revendedora_id.
- Service role: acesso total.

---

## 🧹 Limpeza manual

### Deletar pedido de teste
```sql
delete from comissoes where pedido_id = '<uuid>';
delete from notificacoes where created_at > '2026-06-01' and tipo = 'nova_venda';
delete from pedidos where id = '<uuid>';
```

⚠️ Cuidado com triggers — deletar pedido pago vai disparar revertendo saldo. Veja `comissoes_saldo.sql`.

### Resetar saldo de revendedora (1 linha)
```sql
update revendedoras
set saldo_disponivel = 0, saldo_processando = 0, total_ganho = 0, total_vendas = 0
where subdominio = 'gabrielafernandez-5034';
```

### Reaplicar sync Tray (limpa produtos antigos)
```sql
delete from produtos;  -- cuidado!
-- Depois rodar sync via /admin/destaques
```

⚠️ Vai apagar curadoria de destaques. Geralmente NÃO é o que se quer.

---

## 📚 Veja também

- [SETUP](./SETUP.md) — como aplicar migrations na 1ª vez.
- [RUNBOOK](./RUNBOOK.md) — operações comuns no DB.
