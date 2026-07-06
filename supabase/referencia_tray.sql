-- Referência do produto (campo "model" da Tray, ex: "229ARGOLA", "CP0086").
-- É o código que a revendedora/cliente usa pra identificar a peça.
-- Preenchido pelo sync (traySync) a partir de p.model, limpando o sufixo "//N".
-- Idempotente.
alter table produtos
  add column if not exists referencia text;
