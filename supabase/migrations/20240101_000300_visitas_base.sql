-- ============================================================
-- 20240101_000300_visitas_base
-- ------------------------------------------------------------
-- Cria a tabela `visitas` (tracking de tráfego).
--
-- Schema derivado do dump real do banco prata925
-- (único que tem esta tabela hoje). Nos outros 3 bancos ela não
-- existe e os 4 endpoints do código que usam `visitas`
-- (/api/track, /api/loja/[slug], /api/revendedora/visitas,
-- /api/admin/visitas) falham silenciosamente ali. Cliente novo
-- criado por este repo já sobe com `visitas` funcional.
--
-- Idempotente.
-- ============================================================

-- Sequence dedicada (id é bigserial no banco real).
create sequence if not exists public.visitas_id_seq;

create table if not exists public.visitas (
  id                bigint primary key default nextval('public.visitas_id_seq'),
  pagina            text not null,
  user_agent_short  text,
  referrer          text,
  sessao            text,
  criado_em         timestamptz default now()
);

alter sequence public.visitas_id_seq owned by public.visitas.id;

-- Índices (mesmos nomes do banco real do prata925).
create index if not exists idx_visitas_data       on public.visitas (criado_em desc);
create index if not exists idx_visitas_pagina_data on public.visitas (pagina, criado_em desc);

-- RLS + policy real do prata925: anon/authenticated podem INSERIR
-- (o endpoint /api/track roda no client sem auth). Reads são
-- feitos pelo server via supabaseAdmin (service_role bypassa RLS).
alter table public.visitas enable row level security;

drop policy if exists "anon_insert_visitas" on public.visitas;
create policy "anon_insert_visitas"
  on public.visitas
  for insert
  to anon, authenticated
  with check (true);
