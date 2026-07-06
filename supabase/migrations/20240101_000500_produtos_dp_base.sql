-- ============================================================
-- 20240101_000500_produtos_dp_base
-- ------------------------------------------------------------
-- Cria a tabela `produtos_dp` — catálogo manual (paralelo ao
-- `produtos` sincronizado da Tray).
--
-- Motivação: clientes que não usam Tray precisam de um CRUD manual
-- de produtos. `produtos_dp` guarda esse catálogo alternativo.
-- Todos os 4 bancos têm esta tabela idêntica.
--
-- Schema derivado do dump real dos 4 bancos.
--
-- Drift de policy (nome, semanticamente igual — SELECT public):
--   - `produtos_dp leitura publica` (prata925, sp-folheados)
--   - `produtos_dp_public_read` (sp-folheados, outlet)
--   - `produtos_dp_pub` (dona-prata)
-- Padronizamos como `produtos_dp_public_read`.
--
-- Drift de índices: prata925 tem `idx_produtos_dp_categoria` e
-- `idx_produtos_dp_ordem` além do `idx_produtos_dp_ativo`. Os outros
-- não. Criamos os 3 aqui pra cliente novo já otimizado.
--
-- Idempotente.
-- ============================================================

create table if not exists public.produtos_dp (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descricao      text,
  categoria      text,
  subcategoria   text,
  preco          numeric not null default 0,
  preco_promo    numeric,
  fotos          text[] not null default '{}'::text[],
  estoque        integer not null default 0,
  destaque       boolean not null default false,
  lancamento     boolean not null default false,
  has_variation  boolean not null default false,
  ativo          boolean not null default true,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_produtos_dp_ativo     on public.produtos_dp (ativo)     where ativo = true;
create index if not exists idx_produtos_dp_categoria on public.produtos_dp (categoria) where categoria is not null;
create index if not exists idx_produtos_dp_ordem     on public.produtos_dp (ordem);

alter table public.produtos_dp enable row level security;

drop policy if exists "produtos_dp_public_read" on public.produtos_dp;
create policy "produtos_dp_public_read"
  on public.produtos_dp
  for select
  to public
  using (true);
