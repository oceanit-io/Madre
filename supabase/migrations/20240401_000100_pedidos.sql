-- ============================================================
-- Prata 15 — Día 4 — Tabla `pedidos` (checkout guest)
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

create table if not exists public.pedidos (
  id                    uuid primary key default gen_random_uuid(),
  numero_pedido         text unique,
  created_at            timestamptz not null default now(),
  status                text not null default 'aguardando_pagamento',
  cliente_nome          text not null,
  cliente_email         text not null,
  cliente_cpf           text not null,
  cliente_telefone      text not null,
  endereco_cep          text not null,
  endereco_rua          text not null,
  endereco_numero       text not null,
  endereco_complemento  text,
  endereco_bairro       text not null,
  endereco_cidade       text not null,
  endereco_uf           text not null,
  itens                 jsonb not null,
  subtotal              numeric(10,2) not null,
  frete                 numeric(10,2) not null default 0,
  total                 numeric(10,2) not null,
  regiao_frete          text,
  slug_revendedora      text,
  pagbank_link          text,
  pagbank_pago          boolean not null default false,
  observacoes           text,

  constraint pedidos_status_check
    check (status in ('aguardando_pagamento','pago','enviado','entregue','cancelado')),
  constraint pedidos_uf_check
    check (char_length(endereco_uf) = 2),
  constraint pedidos_regiao_frete_check
    check (regiao_frete is null or regiao_frete in ('sudeste','sul','nordeste','norte_centro_oeste'))
);

-- ---------- Índices ----------
create index if not exists idx_pedidos_cliente_email     on public.pedidos (cliente_email);
create index if not exists idx_pedidos_cliente_cpf       on public.pedidos (cliente_cpf);
create index if not exists idx_pedidos_status            on public.pedidos (status);
create index if not exists idx_pedidos_slug_revendedora  on public.pedidos (slug_revendedora);

-- ---------- RLS ----------
alter table public.pedidos enable row level security;

-- Insert anónimo (guest checkout). El cálculo de subtotal/frete/total
-- se hace SIEMPRE en el server con SERVICE_ROLE, nunca confiando en el cliente.
drop policy if exists "anon_insert_pedidos" on public.pedidos;
create policy "anon_insert_pedidos"
  on public.pedidos
  for insert
  to anon
  with check (true);

-- service_role: acceso total (admin / APIs server-side)
drop policy if exists "service_role_full_access" on public.pedidos;
create policy "service_role_full_access"
  on public.pedidos
  for all
  to service_role
  using (true)
  with check (true);
