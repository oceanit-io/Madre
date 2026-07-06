-- ============================================================
-- Cadastro da revendedora como RECEBEDOR no Pagar.me (split)
-- ============================================================
-- Para habilitar split de pagamentos automático, cada revendedora
-- precisa ser cadastrada como recipient no Pagar.me. O ID retornado
-- pela API /core/v5/recipients fica salvo aqui pra ser usado nas
-- regras de split de cada payment link gerado.
--
-- Status possíveis (espelham a Pagar.me):
--   null         → não preencheu cadastro ainda (CTA banner aparece)
--   draft        → preencheu form mas ainda não enviou pra Pagar.me
--   pending      → enviado, aguardando KYC do Pagar.me
--   active       → KYC aprovado, pode receber split
--   refused      → KYC recusado, precisa revisar dados
--   registration → docs adicionais solicitados pela Pagar.me

alter table public.revendedoras
  add column if not exists pagarme_recipient_id text,
  add column if not exists pagarme_recipient_status text,
  add column if not exists pagarme_recipient_data jsonb;

-- Index pra lookup rápido por recipient_id (usado no webhook do Pagar.me
-- quando recebe atualização de status do KYC).
create index if not exists idx_revendedoras_pagarme_recipient_id
  on public.revendedoras (pagarme_recipient_id)
  where pagarme_recipient_id is not null;

-- Index pra encontrar quem ainda precisa preencher (usado pra mostrar
-- o banner CTA no dashboard).
create index if not exists idx_revendedoras_sem_recipient
  on public.revendedoras (status, pagarme_recipient_status)
  where pagarme_recipient_id is null;
