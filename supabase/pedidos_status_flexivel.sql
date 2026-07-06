-- ============================================================
-- Prata 15 — Status de pedido LIVRE (operação manual)
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Problema: o trigger estrito `pedidos_validar_transicao` bloqueava
-- mudanças que não fossem aguardando→pago→enviado→entregue, então o
-- UPDATE dava rollback e "no cambiaba" no admin.
--
-- Agora: o admin pode mover o pedido para QUALQUER status (livre,
-- inclusive corrigir/reverter). A comissão é GERADA/REATIVADA sempre
-- que o pedido entra em 'pago' (idempotente). 'cancelado' cancela a
-- comissão (exceto se já paga).
-- ============================================================

-- 1) Remover a validação estrita de transição (deixa o status livre)
drop trigger if exists trg_pedidos_validar_transicao on public.pedidos;
drop function if exists public.pedidos_validar_transicao();

-- 2) Histórico + comissão (AFTER UPDATE) — robusto p/ status livre
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

    -- histórico da mudança
    insert into public.pedidos_historico
      (pedido_id, status_anterior, status_novo, created_by)
    values
      (NEW.id, OLD.status, NEW.status, 'admin');

    -- entrou em 'pago' -> gera/reativa comissão (idempotente)
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
        case when v_rev_id is not null then 'liberada' else 'pendente' end,
        case when v_rev_id is not null then now()      else null      end
      )
      on conflict (pedido_id) do update
        set status         = case when excluded.revendedora_id is not null
                                  then 'liberada' else 'pendente' end,
            revendedora_id = excluded.revendedora_id,
            slug_revendedora = excluded.slug_revendedora,
            valor_base     = excluded.valor_base,
            valor_comissao = excluded.valor_comissao,
            data_liberacao = case when excluded.revendedora_id is not null
                                  then now() else null end;
    end if;

    -- cancelado -> cancela comissão (não mexe em comissão já paga)
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

drop trigger if exists trg_pedidos_apos_mudanca_status on public.pedidos;
create trigger trg_pedidos_apos_mudanca_status
  after update on public.pedidos
  for each row
  execute function public.pedidos_apos_mudanca_status();
