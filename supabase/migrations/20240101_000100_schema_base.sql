-- ============================================================
-- 20240101_000100_schema_base
-- ------------------------------------------------------------
-- Base histórica: reproduz o antigo supabase-schema.sql (raiz)
-- de forma idempotente.
--
-- Cria as tabelas mais antigas (revendedoras, saques, notificacoes,
-- vendas) + RLS + policies + função legada confirmar_venda().
--
-- vendas + confirmar_venda são LEGADO (era Asaas → hoje Pagar.me
-- em pedidos + comissoes). Preservados por fidelidade com produção.
-- Cleanup vira migration separada no futuro, com backup.
--
-- notificacoes é preservada por fidelidade — hoje não é mais escrita
-- por nenhum trigger dos SQLs modernos.
--
-- Idempotente:
--   - create table if not exists
--   - drop policy if exists + create policy
--   - create or replace function
--   - alter table enable row level security (pode rodar 2x sem quebrar)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- revendedoras
-- ------------------------------------------------------------
create table if not exists public.revendedoras (
  id                 uuid default uuid_generate_v4() primary key,
  user_id            uuid references auth.users(id) on delete cascade,
  nome               text not null,
  email              text not null unique,
  whatsapp           text not null,
  cidade             text,
  estado             text,
  foto_url           text,
  bio                text,
  subdominio         text unique,
  status             text default 'pendente'
                       check (status in ('pendente', 'ativa', 'suspensa')),
  saldo_disponivel   decimal(10,2) default 0,
  saldo_processando  decimal(10,2) default 0,
  total_ganho        decimal(10,2) default 0,
  total_vendas       integer default 0,
  asaas_customer_id  text,
  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

-- ------------------------------------------------------------
-- vendas (LEGADO Asaas — preservada por fidelidade)
-- ------------------------------------------------------------
create table if not exists public.vendas (
  id              uuid default uuid_generate_v4() primary key,
  revendedora_id  uuid references public.revendedoras(id) on delete cascade,
  pedido_id       text not null,
  cliente_nome    text,
  cliente_email   text,
  produto_nome    text not null,
  produto_foto    text,
  valor_total     decimal(10,2) not null,
  valor_comissao  decimal(10,2) not null,
  status          text default 'processando'
                    check (status in ('processando', 'pago', 'cancelado', 'pendente')),
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

-- ------------------------------------------------------------
-- saques
-- ------------------------------------------------------------
create table if not exists public.saques (
  id                uuid default uuid_generate_v4() primary key,
  revendedora_id    uuid references public.revendedoras(id) on delete cascade,
  tipo              text not null check (tipo in ('pix', 'credito_loja')),
  valor             decimal(10,2) not null,
  chave_pix         text,
  status            text default 'solicitado'
                      check (status in ('solicitado', 'processando', 'pago', 'recusado')),
  asaas_transfer_id text,
  observacao        text,
  criado_em         timestamptz default now(),
  pago_em           timestamptz
);

-- ------------------------------------------------------------
-- notificacoes (preservada por fidelidade — hoje sem uso ativo)
-- ------------------------------------------------------------
create table if not exists public.notificacoes (
  id              uuid default uuid_generate_v4() primary key,
  revendedora_id  uuid references public.revendedoras(id) on delete cascade,
  titulo          text not null,
  mensagem        text not null,
  tipo            text default 'info' check (tipo in ('info', 'venda', 'saque', 'aviso')),
  lida            boolean default false,
  criado_em       timestamptz default now()
);

-- ------------------------------------------------------------
-- RLS: cada revendedora vê só os seus dados
-- Nota: signUp de revendedora em /auth/register usa service_role,
-- portanto bypassa RLS. Estas policies servem pra leitura direta
-- pelo client autenticado (se houver).
-- ------------------------------------------------------------
alter table public.revendedoras  enable row level security;
alter table public.vendas        enable row level security;
alter table public.saques        enable row level security;
alter table public.notificacoes  enable row level security;

drop policy if exists "revendedora_own" on public.revendedoras;
create policy "revendedora_own" on public.revendedoras
  for all using (auth.uid() = user_id);

drop policy if exists "vendas_own" on public.vendas;
create policy "vendas_own" on public.vendas
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

drop policy if exists "saques_own" on public.saques;
create policy "saques_own" on public.saques
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

drop policy if exists "notificacoes_own" on public.notificacoes;
create policy "notificacoes_own" on public.notificacoes
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- confirmar_venda (LEGADO Asaas — preservada por fidelidade)
-- ------------------------------------------------------------
create or replace function public.confirmar_venda(venda_id uuid)
returns void language plpgsql security definer as $$
declare
  v_venda public.vendas;
begin
  select * into v_venda from public.vendas where id = venda_id;

  update public.vendas set status = 'pago', atualizado_em = now()
    where id = venda_id;

  update public.revendedoras
    set saldo_disponivel = saldo_disponivel + v_venda.valor_comissao,
        saldo_processando = saldo_processando - v_venda.valor_comissao,
        total_ganho = total_ganho + v_venda.valor_comissao,
        total_vendas = total_vendas + 1,
        atualizado_em = now()
    where id = v_venda.revendedora_id;

  insert into public.notificacoes (revendedora_id, titulo, mensagem, tipo)
    values (
      v_venda.revendedora_id,
      'Comissão creditada! 🎉',
      'Você recebeu R$' || v_venda.valor_comissao || ' pela venda de ' || v_venda.produto_nome,
      'venda'
    );
end;
$$;
