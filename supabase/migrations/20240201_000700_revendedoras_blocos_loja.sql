-- Toggles dos blocos opcionais do storefront.
-- Cada revendedora decide quais blocos quer mostrar na loja.
-- Default = todos ligados (mostrar_*=true) pra não quebrar lojas já ativas.
-- Idempotente.
alter table revendedoras
  add column if not exists mostrar_bloco_prata925 boolean not null default true,
  add column if not exists mostrar_bloco_depoimentos boolean not null default true,
  add column if not exists mostrar_bloco_garantias boolean not null default true;
