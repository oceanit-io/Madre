-- Registra quando a revendedora aceitou a política de privacidade.
-- Conformidade LGPD: precisamos provar quando o consentimento foi dado.
-- NULL = legado (antes do checkbox existir).
-- Idempotente.
alter table revendedoras
  add column if not exists aceitou_termos_em timestamptz;
