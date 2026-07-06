-- ============================================================
-- Prata 15 — Controle de baixa de estoque na Tray
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Marca quais pedidos JÁ tiveram o estoque abatido manualmente na Tray,
-- pra o relatório não repetir os mesmos itens (evita conflito de stock
-- entre a loja da revendedora e a Tray).
-- ============================================================

alter table public.pedidos
  add column if not exists baixado_tray boolean not null default false;
alter table public.pedidos
  add column if not exists baixado_tray_em timestamptz;

create index if not exists idx_pedidos_baixado_tray
  on public.pedidos (baixado_tray)
  where baixado_tray = false;
