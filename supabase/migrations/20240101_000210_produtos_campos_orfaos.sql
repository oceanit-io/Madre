-- ============================================================
-- 20240101_000210_produtos_campos_orfaos
-- ------------------------------------------------------------
-- Adiciona 6 colunas em `produtos` que existem em produção
-- (todos os 4 bancos) mas que nenhum SQL histórico do repo
-- criava — foram adicionadas à mão ao longo do tempo.
--
-- Colunas cobertas:
--   - altura_cm      — dimensão pra cálculo de frete real (Correios).
--   - largura_cm     — idem.
--   - comprimento_cm — idem.
--   - itens_inclusos — texto livre (ex: "1 par de brincos + estojo").
--   - url_tray       — URL do produto no site da Tray (deep link).
--   - criado_em      — timestamp de criação (par com atualizado_em).
--
-- Vem logo depois de produtos_base (000200), antes das ADD COLUMN
-- do bloco 2 (destaque_tray, referencia, subcategoria, etc).
--
-- Idempotente.
-- ============================================================

alter table public.produtos
  add column if not exists altura_cm      numeric,
  add column if not exists largura_cm     numeric,
  add column if not exists comprimento_cm numeric,
  add column if not exists itens_inclusos text,
  add column if not exists url_tray       text,
  add column if not exists criado_em      timestamptz default now();
