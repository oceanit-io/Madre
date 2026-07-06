-- ============================================================
-- Prata 15 — Personalização da loja da revendedora
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
-- ============================================================

-- Cor do tema da loja (hex, ex: '#E8396A'). NULL = usa o padrão (#1A1A1A).
alter table public.revendedoras
  add column if not exists cor_tema text;

-- O logo usa a coluna `foto_url` que JÁ existe (nada a fazer aqui).

-- ============================================================
-- PASSO MANUAL — criar o bucket de logos (Storage)
-- ------------------------------------------------------------
-- 1) Supabase > Storage > "New bucket"
-- 2) Name: logos
-- 3) Marcar "Public bucket"  ✅  (necessário p/ a loja exibir a imagem)
-- 4) Create
--
-- Não precisa de SQL de policies: o upload é feito pelo servidor com
-- a SERVICE_ROLE (ignora RLS) e a leitura é pública pelo bucket público.
-- ============================================================
