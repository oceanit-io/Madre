-- ============================================================
-- Subcategoria derivada do slug da Tray
-- ============================================================
-- Os slugs dos produtos têm estrutura "categoria/subcategoria/produto"
-- (ex: "correntes/com-pingente/corrente-45cm-..."). Aprendemos a
-- subcategoria do 2º segmento, quando o slug tem 3+ segmentos.
--
-- Coluna nullable: produtos sem subcategoria (slug de 2 segmentos)
-- continuam só com `categoria`. O sync popula em syncTray().

alter table public.produtos
  add column if not exists subcategoria text;

create index if not exists idx_produtos_subcategoria
  on public.produtos (subcategoria)
  where subcategoria is not null;

-- Composto: útil pra filtrar produtos por (categoria pai, subcategoria)
create index if not exists idx_produtos_categoria_subcategoria
  on public.produtos (categoria, subcategoria)
  where ativo = true;
