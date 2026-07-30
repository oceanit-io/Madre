-- Guarda o SERVIÇO de frete escolhido (PAC/SEDEX/PADRAO) no pedido, pra
-- aparecer na folha de envio pro cliente. Pedidos antigos ficam null.
-- Aplicado em prod via Management API.
alter table public.pedidos
  add column if not exists frete_servico text;
