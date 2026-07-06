-- Banner de design escolhido pela revendedora p/ o hero da loja.
-- Valores: id de BANNERS_LOJA (vibrante | aurora | porsol | oceano | luxo).
-- null/'' => 'vibrante' (usa a cor da loja). Idempotente.
alter table revendedoras
  add column if not exists banner_preset text;
