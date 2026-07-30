-- ============================================================
-- Prata 15 — Correções de segurança (17/06/2026)
-- Já APLICADO no Supabase (registro pra histórico).
--
-- Origem: auditoria de segurança + Supabase security advisors.
-- ============================================================

-- 1) RPC de mensalidade só pode ser chamada pelo webhook (service_role).
--    Antes estava executável por anon/authenticated via /rest/v1/rpc → dava
--    pra ativar loja de graça (bypass do pagamento). Service_role (webhook)
--    mantém o execute.
revoke execute on function public.registrar_pagamento_mensalidade(uuid, numeric, text, text)
  from anon, authenticated, public;
grant execute on function public.registrar_pagamento_mensalidade(uuid, numeric, text, text)
  to service_role;

-- 2) Fixa o search_path do trigger de vencimento (advisor 0011).
create or replace function public.revendedora_set_vencimento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status = 'ativa'
     and NEW.mensalidade_vence_em is null
     and coalesce(NEW.mensalidade_isento, false) = false then
    NEW.mensalidade_vence_em := current_date + 30;
  end if;
  return NEW;
end;
$$;

-- 3) RLS nas tabelas admin (estavam expostas via /rest/v1 com a anon key).
--    São acessadas só via service_role (que bypassa RLS), então habilitar
--    RLS sem policy = anon/authenticated não leem mais, app segue funcionando.
alter table public.admin_alertas enable row level security;
alter table public.admin_audit_log enable row level security;
