-- Destaques personalizados por revendedora: lista (ordenada) de SKUs que ela
-- escolhe pra vitrine. NULL/vazio = usa os destaques padrão (flag global
-- produtos.destaque / destaque_tray).
alter table public.revendedoras
  add column if not exists destaques_skus jsonb;

comment on column public.revendedoras.destaques_skus is
  'Lista ordenada de SKUs escolhidos pela revendedora pra vitrine. NULL/[] = usa destaques padrão (produtos.destaque).';
