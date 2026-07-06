-- ============================================================
-- Prata 15 — Infraestrutura de comissões + histórico de pedidos
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- NOTA: la tabla `saques` del brief NO se crea aquí. Ya existe en
-- producción con otro schema y está en uso por /api/saques, /saldo
-- y ModalSaque. Se reconciliará al construir el panel de revendedora.
--
-- NOTA 2: el trigger resuelve la revendedora por `revendedoras.subdominio`
-- (NO `slug`, que no existe). `pedidos.slug_revendedora` guarda justamente
-- el valor del `subdominio` (ver /api/pedidos/[id]/route.ts del Día 4).
-- ============================================================

-- ------------------------------------------------------------
-- A) Tabla pedidos_historico
-- ------------------------------------------------------------
create table if not exists public.pedidos_historico (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid references public.pedidos(id) on delete cascade,
  status_anterior  text,
  status_novo      text not null,
  observacao       text,
  created_at       timestamptz not null default now(),
  created_by       text default 'admin'
);

create index if not exists idx_pedidos_historico_pedido_id
  on public.pedidos_historico (pedido_id);

alter table public.pedidos_historico enable row level security;

drop policy if exists "service_role_full_access" on public.pedidos_historico;
create policy "service_role_full_access"
  on public.pedidos_historico
  for all to service_role
  using (true) with check (true);

-- ------------------------------------------------------------
-- B) Tabla comissoes
-- ------------------------------------------------------------
create table if not exists public.comissoes (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid unique references public.pedidos(id) on delete cascade,
  revendedora_id    uuid references public.revendedoras(id),
  slug_revendedora  text not null,
  valor_base        numeric(10,2) not null,            -- subtotal del pedido (sem frete)
  percentual        numeric(5,2)  not null default 30.00,
  valor_comissao    numeric(10,2) not null,            -- valor_base * percentual / 100
  status            text not null default 'pendente'
                      check (status in ('pendente','liberada','paga','cancelada')),
  data_liberacao    timestamptz,
  data_pagamento    timestamptz,
  created_at        timestamptz not null default now(),
  observacao        text
);

create index if not exists idx_comissoes_revendedora_id
  on public.comissoes (revendedora_id);
create index if not exists idx_comissoes_slug_revendedora
  on public.comissoes (slug_revendedora);
create index if not exists idx_comissoes_status
  on public.comissoes (status);

alter table public.comissoes enable row level security;

drop policy if exists "service_role_full_access" on public.comissoes;
create policy "service_role_full_access"
  on public.comissoes
  for all to service_role
  using (true) with check (true);

-- ------------------------------------------------------------
-- E) Validação de transição de status (BEFORE UPDATE)
--    aguardando_pagamento -> pago | cancelado
--    pago                 -> enviado | cancelado
--    enviado              -> entregue | cancelado
--    entregue / cancelado -> (final, bloqueado)
-- ------------------------------------------------------------
create or replace function public.pedidos_validar_transicao()
returns trigger
language plpgsql
as $$
begin
  if NEW.status is distinct from OLD.status then
    if not (
      (OLD.status = 'aguardando_pagamento' and NEW.status in ('pago','cancelado')) or
      (OLD.status = 'pago'                  and NEW.status in ('enviado','cancelado')) or
      (OLD.status = 'enviado'               and NEW.status in ('entregue','cancelado'))
    ) then
      raise exception 'Transição de status inválida: % -> %', OLD.status, NEW.status
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_pedidos_validar_transicao on public.pedidos;
create trigger trg_pedidos_validar_transicao
  before update on public.pedidos
  for each row
  execute function public.pedidos_validar_transicao();

-- ------------------------------------------------------------
-- D) Histórico + comissão (AFTER UPDATE)
--    1. Registra mudança em pedidos_historico
--    2. status='pago'      -> cria comissão (liberada se achar revendedora)
--    3. status='cancelado' -> cancela comissão existente (exceto se já paga)
-- ------------------------------------------------------------
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
        case when v_rev_id is not null then 'liberada' else 'pendente' end,
        case when v_rev_id is not null then now()      else null      end
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

drop trigger if exists trg_pedidos_apos_mudanca_status on public.pedidos;
create trigger trg_pedidos_apos_mudanca_status
  after update on public.pedidos
  for each row
  execute function public.pedidos_apos_mudanca_status();

-- ============================================================
-- TESTE MANUAL DO TRIGGER (opcional, rodar depois)
-- ------------------------------------------------------------
-- 1) Pegar um pedido existente aguardando pagamento:
--    select id, numero_pedido, status, slug_revendedora, subtotal
--      from pedidos where status = 'aguardando_pagamento' limit 1;
--
-- 2) Marcar como pago (troque o UUID):
--    update pedidos set status = 'pago'
--      where id = 'COLE_O_UUID_AQUI';
--
-- 3) Conferir que criou histórico e comissão:
--    select * from pedidos_historico where pedido_id = 'COLE_O_UUID_AQUI';
--    select * from comissoes        where pedido_id = 'COLE_O_UUID_AQUI';
--
-- 4) Testar transição inválida (deve dar erro):
--    update pedidos set status = 'entregue'
--      where id = 'COLE_O_UUID_AQUI';   -- pago -> entregue: ERRO esperado
-- ============================================================
