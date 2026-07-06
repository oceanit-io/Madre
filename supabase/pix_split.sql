-- ============================================================
-- PIX direto com split via /v5/orders (limitação Pagar.me v5:
-- paymentlinks só fazem split em credit_card, não em PIX).
--
-- Colunas adicionais na tabela pedidos pra guardar dados do PIX:
--   pagarme_order_id  → ID da order Pagar.me (pra reconciliar / cancelar)
--   pagarme_charge_id → ID da charge Pagar.me
--   pix_qr_code       → string "BR copia e cola" (long)
--   pix_qr_code_url   → URL pública do QR code (imagem PNG)
--   pix_expira_em     → timestamp de expiração do código PIX
--
-- Não removemos pagbank_link — continua usado pra cartão (paymentlink).
-- ============================================================

alter table public.pedidos
  add column if not exists pagarme_order_id   text,
  add column if not exists pagarme_charge_id  text,
  add column if not exists pix_qr_code        text,
  add column if not exists pix_qr_code_url    text,
  add column if not exists pix_expira_em      timestamptz;

create index if not exists idx_pedidos_pagarme_order_id
  on public.pedidos (pagarme_order_id)
  where pagarme_order_id is not null;
