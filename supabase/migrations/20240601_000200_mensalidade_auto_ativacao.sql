-- ============================================================
-- Prata 15 — Ativação/renovação automática da mensalidade
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Contexto: o pagamento da mensalidade (R$39,90) passa a ativar/renovar
-- a loja SOZINHO via webhook (order_nsu = cad_<revendedora_id>). Antes,
-- a ativação automática nem setava `mensalidade_vence_em` — então a loja
-- ativava mas o cron de cobrança a ignorava (nunca renovava = fuga de
-- receita). Este script fecha isso:
--
--   1. Trigger de segurança: qualquer status -> 'ativa' sem vencimento
--      ganha hoje+30 (cobre TODOS os caminhos: webhook, confirm, manual).
--   2. Função idempotente registrar_pagamento_mensalidade(): ativa OU
--      renova (estende o vencimento), grava o pagamento e NÃO reaplica o
--      mesmo pagamento 2x (dedup por provider_tx — webhook reenvia).
--
-- Idempotente: pode rodar 2x sem efeito duplo.
-- ============================================================

-- 1) Dedup de pagamentos por transação do provider (InfinitePay/PagBank).
--    Partial unique: permite vários NULL (pagamentos manuais sem tx).
alter table public.mensalidades_pagamentos
  add column if not exists provider_tx text;
create unique index if not exists uq_mens_pag_provider_tx
  on public.mensalidades_pagamentos (provider_tx)
  where provider_tx is not null;

-- 2) Trigger de segurança: status -> 'ativa' sem vencimento => hoje+30.
--    Não toca quem é isento nem quem já tem data. BEFORE pra alterar NEW.
create or replace function public.revendedora_set_vencimento()
returns trigger
language plpgsql
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

drop trigger if exists trg_revendedora_vencimento on public.revendedoras;
create trigger trg_revendedora_vencimento
  before insert or update on public.revendedoras
  for each row
  execute function public.revendedora_set_vencimento();

-- 3) Função central: registra um pagamento de mensalidade e ativa/renova.
--    - dedup por p_provider_tx (se já existe, retorna aplicado=false).
--    - base do novo vencimento = maior entre hoje e o vencimento atual
--      (pagar adiantado ESTENDE; pagar atrasado conta de hoje).
--    - +30 dias. Marca status='ativa' sempre.
create or replace function public.registrar_pagamento_mensalidade(
  p_rev_id      uuid,
  p_valor       numeric,
  p_metodo      text,
  p_provider_tx text default null
)
returns table(aplicado boolean, vence_novo date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual date;
  v_novo  date;
begin
  -- idempotência: mesmo pagamento chega 2x (webhook reenvia) => no-op.
  if p_provider_tx is not null and exists (
    select 1 from public.mensalidades_pagamentos where provider_tx = p_provider_tx
  ) then
    select mp.vence_novo into v_novo
      from public.mensalidades_pagamentos mp
     where mp.provider_tx = p_provider_tx
     order by mp.created_at desc
     limit 1;
    return query select false, v_novo;
    return;
  end if;

  select mensalidade_vence_em into v_atual
    from public.revendedoras
   where id = p_rev_id
   for update;

  if not found then
    return query select false, null::date;
    return;
  end if;

  v_novo := greatest(current_date, coalesce(v_atual, current_date)) + 30;

  update public.revendedoras
     set status = 'ativa',
         mensalidade_vence_em = v_novo,
         atualizado_em = now()
   where id = p_rev_id;

  insert into public.mensalidades_pagamentos
    (revendedora_id, valor, metodo, vence_novo, provider_tx, created_by)
  values
    (p_rev_id, p_valor, p_metodo, v_novo, p_provider_tx, 'webhook');

  return query select true, v_novo;
end;
$$;
