-- ============================================================
-- Prata 15 — Destaque vindo da Tray (campo `hot`) + manual
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- `destaque`       = curado MANUAL no back office (não é tocado pelo sync)
-- `destaque_tray`  = vem do `hot` da Tray (atualizado a cada sync)
-- Na loja, é destaque se QUALQUER um dos dois for true.
-- ============================================================

alter table public.produtos
  add column if not exists destaque_tray boolean not null default false;

create index if not exists idx_produtos_destaque_tray
  on public.produtos (destaque_tray)
  where destaque_tray = true;
