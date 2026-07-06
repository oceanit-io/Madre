-- ============================================================
-- 00000000_000000_schema_migrations
-- ------------------------------------------------------------
-- Tabela de controle usada pelo runner (scripts/aplicar-migrations.ts).
-- Cada migration aplicada com sucesso registra uma linha aqui.
-- É a PRIMEIRA migration em qualquer banco (novo ou existente).
--
-- Idempotente: create table if not exists.
-- ============================================================

create table if not exists public.schema_migrations (
  versao      text primary key,
  aplicada_em timestamptz not null default now()
);

comment on table public.schema_migrations is
  'Controle interno: nome de arquivo (sem .sql) de cada migration já aplicada.';
