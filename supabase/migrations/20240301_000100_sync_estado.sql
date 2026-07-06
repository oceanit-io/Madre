-- ============================================================
-- Prata 15 — Sync de catálogo desde Tray (web_api público)
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Trae produtos de https://www.pratade15reais.com.br/web_api/products
-- (precio LLENO, fotos, nome, categoria, disponibilidade). Upsert por
-- `sku` (= id de Tray). PRESERVA `destaque` e demais campos curados
-- (o upsert só toca as colunas sincronizadas).
-- ============================================================

-- 1) Índice único em sku (0 duplicados verificado) — habilita upsert
create unique index if not exists produtos_sku_uidx on public.produtos (sku);

-- 2) Estado do sync (cursor de paginação + último resultado)
create table if not exists public.sync_estado (
  chave         text primary key,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.sync_estado (chave, valor)
values ('tray', '{"proxima_pagina": 1}'::jsonb)
on conflict (chave) do nothing;

alter table public.sync_estado enable row level security;
drop policy if exists "service_role_full_access" on public.sync_estado;
create policy "service_role_full_access"
  on public.sync_estado for all to service_role
  using (true) with check (true);
