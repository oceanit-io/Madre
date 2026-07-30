-- Busca de produtos aberta: multi-campo, multi-palavra e SEM acento.
-- A revendedora reclamava que não achava produtos (ex. "trevo") buscando
-- termos parciais — a busca antiga era só ilike no `nome`, 1 palavra, com
-- acento estrito. Agora indexamos um texto normalizado.
--
-- unaccent é STABLE; pra usar em coluna GENERATED precisa de um wrapper
-- IMMUTABLE (truque padrão com a forma de 2 args que fixa o dicionário).

create extension if not exists unaccent;

create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Texto de busca: nome + descrição + categoria + subcategoria + sku,
-- tudo minúsculo e sem acento. STORED → calculado uma vez por linha.
alter table public.produtos
  add column if not exists busca_texto text
  generated always as (
    lower(public.immutable_unaccent(
      coalesce(nome, '') || ' ' ||
      coalesce(categoria, '') || ' ' ||
      coalesce(subcategoria, '') || ' ' ||
      coalesce(sku, '')
    ))
  ) stored;

-- 2999 linhas → seq scan já é rápido, mas o índice trigram deixa o ilike
-- '%termo%' instantâneo. pg_trgm normalmente já vem no Supabase.
create extension if not exists pg_trgm;
create index if not exists idx_produtos_busca_texto
  on public.produtos using gin (busca_texto gin_trgm_ops);
