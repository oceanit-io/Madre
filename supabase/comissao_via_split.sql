-- ============================================================
-- Fix C3/C4 (auditoria jun/2026): evita PAGAR A COMISSÃO 2x.
--
-- Problema: quando a revendedora tem KYC ATIVO, o split do Pagar.me paga
-- os 30% DIRETO no recipient dela (dinheiro real cai na conta dela). Mas o
-- trigger SEMPRE criava a comissão em 'processando' → virava saldo sacável,
-- então ela sacava de novo os mesmos 30%. Dobro.
--
-- Solução: o checkout marca `pedidos.comissao_via_split = true` quando o
-- split real pagou a revendedora. O trigger, nesse caso, registra a comissão
-- como 'paga' (histórico/relatório) e NÃO credita saldo.
--
-- SEGURO: default false. Hoje NENHUMA revendedora tem KYC ativo, então todos
-- os pedidos ficam com false → comportamento IDÊNTICO ao atual (processando →
-- saldo → saque). Só muda pra pedidos futuros com split real.
--
-- Idempotente (create or replace / if not exists).
-- ============================================================

-- 1) Flag no pedido: a comissão desse pedido já foi paga pelo split Pagar.me?
alter table public.pedidos
  add column if not exists comissao_via_split boolean not null default false;

-- 2) Recria o trigger pedido→comissão respeitando o flag.
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

    -- 2. comissão ao marcar como pago
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
        -- Se a comissão JÁ foi paga direto pelo split (KYC ativo): 'paga' e
        -- NÃO credita saldo (o trigger de saldo só credita 'processando'/
        -- 'liberada'). Senão, mantém o fluxo normal de saldo + saque.
        case
          when NEW.comissao_via_split then 'paga'
          when v_rev_id is not null then 'processando'
          else 'pendente'
        end,
        case
          when NEW.comissao_via_split then null
          when v_rev_id is not null then now() + interval '20 days'
          else null
        end
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
