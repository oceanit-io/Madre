-- ============================================================
-- Prata 15 — Personalização: cor de fundo da loja
-- Aplicar en: Supabase Management API ou SQL Editor
--
-- Aditiva e idempotente. Coluna nullable. Valores válidos
-- ('claro' | 'creme' | 'rosa' | 'cinza' | 'preto') validados na app
-- via fundoValido() em lib/temasLoja.ts. NULL = padrão (#FAFAFA off-white).
-- ============================================================

alter table public.revendedoras
  add column if not exists cor_fundo text;
