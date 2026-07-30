-- ============================================================
-- Prata 15 — Política de liberación de comissão em 20 dias
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Cambio de política: al pedido marcarse `pago`, la comissão entra
-- em `processando` (creditada em `saldo_processando`) com `data_liberacao
-- = agora + 20 dias`. Após esse prazo, um cron diário move
-- `processando → liberada` (debita saldo_processando, credita
-- saldo_disponivel). Cancelamentos antes da maturação debitam o saldo
-- correto. Anti-fraude/chargeback/devolución.
--
-- Requiere: supabase/comissoes.sql + supabase/comissoes_saldo.sql
-- (já aplicados). Este script é IDEMPOTENTE — pode rodar 2x sem efeito
-- duplo (usa `if not exists` / `create or replace`).
-- ============================================================

-- 1) Amplia o check de status para incluir 'processando'.
alter table public.comissoes drop constraint if exists comissoes_status_check;
alter table public.comissoes add constraint comissoes_status_check
  check (status in ('pendente','processando','liberada','paga','cancelada'));

-- 2) Flag de tracking: comissão atualmente em saldo_processando.
--    (Distinto de `creditada` que rastreia em saldo_disponivel.)
alter table public.comissoes
  add column if not exists em_processando boolean not null default false;

-- 3) Trigger pedido → comissão: agora cria como 'processando' com
--    data_liberacao = now() + 20 dias. Se não achar revendedora, fica
--    'pendente' (órfão) — mesmo comportamento de antes.
create or replace function public.pedidos_apos_mudanca_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev_id uuid;
begin
  if NEW.status is distinct from OLD.status then

    -- 1. histórico da transição
    insert into public.pedidos_historico
      (pedido_id, status_anterior, status_novo, created_by)
    values
      (NEW.id, OLD.status, NEW.status, 'admin');

    -- 2. comissão ao marcar como pago — entra em 'processando' por 20d
    if NEW.status = 'pago' and NEW.slug_revendedora is not null then
      select id into v_rev_id
        from public.revendedoras
        where subdominio = NEW.slug_revendedora
        limit 1;

      insert into public.comissoes (
        pedido_id, revendedora_id, slug_revendedora,
        valor_base, percentual, valor_comissao,
        status, data_liberacao
      )
      values (
        NEW.id, v_rev_id, NEW.slug_revendedora,
        NEW.subtotal, 30.00, round(NEW.subtotal * 0.30, 2),
        case when v_rev_id is not null then 'processando' else 'pendente' end,
        case when v_rev_id is not null then now() + interval '20 days' else null end
      )
      on conflict (pedido_id) do nothing;
    end if;

    -- 3. cancelamento -> cancela comissão (não mexe em comissão já paga)
    if NEW.status = 'cancelado' then
      update public.comissoes
         set status = 'cancelada'
       where pedido_id = NEW.id
         and status <> 'paga';
    end if;

  end if;
  return NEW;
end;
$$;

-- 4) Trigger comissão ↔ saldo: gerencia AMBOS saldo_processando e
--    saldo_disponivel, evitando duplicação e revertendo cancelamentos.
create or replace function public.comissoes_sincronizar_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (a) INSERT como 'processando': credita saldo_processando.
  if TG_OP = 'INSERT'
     and NEW.status = 'processando'
     and NEW.em_processando = false
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_processando = coalesce(saldo_processando, 0) + NEW.valor_comissao
     where id = NEW.revendedora_id;
    NEW.em_processando := true;
    return NEW;
  end if;

  -- (b) INSERT como 'liberada' (caminho legado): credita saldo_disponivel.
  if TG_OP = 'INSERT'
     and NEW.status = 'liberada'
     and NEW.creditada = false
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_disponivel = coalesce(saldo_disponivel, 0) + NEW.valor_comissao
     where id = NEW.revendedora_id;
    NEW.creditada := true;
    return NEW;
  end if;

  -- (c) UPDATE: processando → liberada (cron de maturação).
  --     Debita saldo_processando e credita saldo_disponivel.
  if TG_OP = 'UPDATE'
     and OLD.status = 'processando' and NEW.status = 'liberada'
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_processando = greatest(coalesce(saldo_processando, 0) - NEW.valor_comissao, 0),
           saldo_disponivel  = coalesce(saldo_disponivel, 0) + NEW.valor_comissao
     where id = NEW.revendedora_id;
    NEW.em_processando := false;
    NEW.creditada := true;
    return NEW;
  end if;

  -- (d) UPDATE: cancelamento durante processando — debita saldo_processando.
  if TG_OP = 'UPDATE'
     and NEW.status = 'cancelada'
     and OLD.em_processando = true
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_processando = greatest(coalesce(saldo_processando, 0) - NEW.valor_comissao, 0)
     where id = NEW.revendedora_id;
    NEW.em_processando := false;
    return NEW;
  end if;

  -- (e) UPDATE: cancelamento após liberação — debita saldo_disponivel
  --     (comportamento original mantido).
  if TG_OP = 'UPDATE'
     and NEW.status = 'cancelada'
     and OLD.creditada = true
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_disponivel = greatest(coalesce(saldo_disponivel, 0) - NEW.valor_comissao, 0)
     where id = NEW.revendedora_id;
    NEW.creditada := false;
    return NEW;
  end if;

  return NEW;
end;
$$;

-- O trigger já existe (de comissoes_saldo.sql); apenas a função foi
-- recriada. Se quiser garantir, drop+create:
drop trigger if exists trg_comissoes_sincronizar_saldo on public.comissoes;
create trigger trg_comissoes_sincronizar_saldo
  before insert or update on public.comissoes
  for each row
  execute function public.comissoes_sincronizar_saldo();

-- 5) RPC chamada pelo cron diário: libera tudo o que maturou.
--    Retorna a quantidade de comissões liberadas.
create or replace function public.liberar_comissoes_maduras()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  qtd int;
begin
  update public.comissoes
     set status = 'liberada'
   where status = 'processando'
     and data_liberacao is not null
     and data_liberacao <= now();
  get diagnostics qtd = row_count;
  return qtd;
end;
$$;

-- ============================================================
-- VERIFICAÇÃO RÁPIDA (opcional)
--   select status, count(*), sum(valor_comissao)
--     from comissoes group by status order by 1;
--   select id, nome, saldo_processando, saldo_disponivel
--     from revendedoras where saldo_processando > 0 or saldo_disponivel > 0;
--   select public.liberar_comissoes_maduras();   -- roda manual o cron
-- ============================================================
