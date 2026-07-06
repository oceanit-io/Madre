-- Cor da cinta de avisos (barra animada do topo da loja). Hex da paleta
-- (TEMAS_LOJA). null => preto clássico (#1A1A1A). A fonte da cinta usa a
-- tipografia já escolhida pela revendedora (revendedoras.fonte). Idempotente.
alter table revendedoras
  add column if not exists cinta_cor text;
