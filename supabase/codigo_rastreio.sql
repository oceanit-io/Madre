-- Código de rastreamento dos Correios pra cada pedido.
-- A revendedora preenche depois de despachar; cliente pode acompanhar.
-- Idempotente.
alter table pedidos
  add column if not exists codigo_rastreio text;
