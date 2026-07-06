-- Texto do hero/banner editável pela revendedora.
-- Antes: título fixo "Joias que contam histórias suas" no storefront.
-- Agora: revendedora pode customizar (2 linhas, sendo a 2ª em itálico).
-- Vazio = mostra default.
-- Idempotente.
alter table revendedoras
  add column if not exists hero_titulo text,
  add column if not exists hero_subtitulo text;
