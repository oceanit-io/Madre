-- ============================================================
-- Prata 15 — Personalização: tipografia da loja
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Adiciona coluna `fonte` na tabela revendedoras. Aditiva e
-- idempotente. Valores válidos: 'montserrat' | 'playfair' | 'poppins'
-- (validados na app via fonteValida() em lib/temasLoja.ts). NULL =
-- padrão (Montserrat).
-- ============================================================

alter table public.revendedoras
  add column if not exists fonte text;
