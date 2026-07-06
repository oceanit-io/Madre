-- ============================================================
-- 20240101_000110_revendedoras_campos_orfaos
-- ------------------------------------------------------------
-- Adiciona 5 colunas em `revendedoras` que existem em produção
-- (todos os 4 bancos) mas que nenhum SQL histórico do repo
-- criava — foram adicionadas à mão ao longo do tempo.
--
-- Colunas cobertas:
--   - nome_loja                — nome comercial da loja (ex: "Ana Prata").
--                                Usado no título da vitrine e e-mails.
--   - instagram                — @ do instagram (link no rodapé).
--   - tiktok                   — @ do tiktok (link no rodapé).
--   - banner_url               — URL de banner customizado (sobrepõe preset).
--   - lembrete_24h_enviado_em  — timestamp do e-mail "sua mensalidade
--                                vence em 24h" (idempotência do cron).
--
-- Vem logo depois de schema_base (000100), antes das customizações
-- de vitrine (200201_*) que já dependem de cor_tema/fonte/etc.
--
-- Idempotente.
-- ============================================================

alter table public.revendedoras
  add column if not exists nome_loja               text,
  add column if not exists instagram               text,
  add column if not exists tiktok                  text,
  add column if not exists banner_url              text,
  add column if not exists lembrete_24h_enviado_em timestamptz;
