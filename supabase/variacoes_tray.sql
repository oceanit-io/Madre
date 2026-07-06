-- Variações de produto (Tray): tamanho/cor/comprimento de corrente, etc.
--
-- A Tray expõe `has_variation` na listagem de produtos. O DETALHE das
-- variações (EAN, atributos, foto, disponibilidade) é fetchado sob demanda
-- em /api/produtos/[id]/variacoes e cacheado aqui pra não bater na Tray toda vez.
--
-- Idempotente: pode rodar mais de uma vez sem erro.

-- Produto tem variações na Tray? (setado pelo sync em traySync.ts)
alter table produtos
  add column if not exists has_variation boolean not null default false;

-- Cache do detalhe das variações (array de VariacaoNormalizada).
-- null = ainda não buscado; [] = buscado e sem variações úteis.
alter table produtos
  add column if not exists variacoes_cache jsonb;

-- Índice parcial: só os produtos COM variação importam pra essa feature.
create index if not exists idx_produtos_has_variation
  on produtos (has_variation)
  where has_variation = true;
