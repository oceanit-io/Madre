-- ============================================================
-- Prata 15 — Unificación de saldo: comissões liberadas → saldo_disponivel
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Estrategia HÍBRIDA y NO destructiva:
--   * `revendedoras.saldo_disponivel` sigue siendo el saldo único que
--     habilita los saques (ModalSaque / /api/saques / RPC debitar_saldo
--     NO se tocan).
--   * Cada comissão que queda 'liberada' se ACREDITA una sola vez en
--     saldo_disponivel (flag `creditada` para idempotencia).
--   * Si una comissão creditada pasa a 'cancelada', se DEBITA de vuelta.
--   * Los saldos legacy (sistema `vendas`) quedan intactos: no hay doble
--     conteo porque `comissoes` proviene del checkout nuevo (pedidos),
--     fuente disjunta del legacy.
--
-- Requiere: supabase/comissoes.sql ya ejecutado (tabla comissoes + trigger
-- de pedidos que crea las comissões).
-- ============================================================

-- 1) Flag de idempotencia (aditivo)
alter table public.comissoes
  add column if not exists creditada boolean not null default false;

-- 2) Trigger BEFORE INSERT/UPDATE: acredita / debita saldo_disponivel
create or replace function public.comissoes_sincronizar_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Acreditar cuando la comissão está liberada, tiene revendedora y aún
  -- no fue creditada.
  if NEW.status = 'liberada'
     and NEW.creditada = false
     and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_disponivel = coalesce(saldo_disponivel, 0) + NEW.valor_comissao
     where id = NEW.revendedora_id;
    NEW.creditada := true;

  -- Revertir si una comissão ya creditada se cancela.
  elsif TG_OP = 'UPDATE'
        and NEW.status = 'cancelada'
        and OLD.creditada = true
        and NEW.revendedora_id is not null then
    update public.revendedoras
       set saldo_disponivel = greatest(coalesce(saldo_disponivel, 0) - NEW.valor_comissao, 0)
     where id = NEW.revendedora_id;
    NEW.creditada := false;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_comissoes_sincronizar_saldo on public.comissoes;
create trigger trg_comissoes_sincronizar_saldo
  before insert or update on public.comissoes
  for each row
  execute function public.comissoes_sincronizar_saldo();

-- 3) Backfill idempotente: acredita comissões liberadas preexistentes
--    (el trigger marca creditada=true, así que correr esto 2 veces no
--     duplica el crédito).
update public.comissoes
   set status = status
 where status = 'liberada'
   and creditada = false
   and revendedora_id is not null;

-- ============================================================
-- VERIFICACIÓN (opcional)
--   select revendedora_id, count(*), sum(valor_comissao)
--     from comissoes where status='liberada' and creditada group by 1;
--   select id, nome, saldo_disponivel from revendedoras order by saldo_disponivel desc;
-- ============================================================
