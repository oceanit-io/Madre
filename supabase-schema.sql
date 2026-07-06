-- ============================================================
-- PRATA 15 — SCHEMA COMPLETO SUPABASE
-- Cole isso no SQL Editor do seu projeto Supabase
-- ============================================================

-- EXTENSÕES
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: revendedoras
-- ============================================================
create table public.revendedoras (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  whatsapp text not null,
  cidade text,
  estado text,
  foto_url text,
  bio text,
  subdominio text unique, -- ex: "ana" para ana.prata15.com.br
  status text default 'pendente' check (status in ('pendente', 'ativa', 'suspensa')),
  saldo_disponivel decimal(10,2) default 0,
  saldo_processando decimal(10,2) default 0,
  total_ganho decimal(10,2) default 0,
  total_vendas integer default 0,
  asaas_customer_id text, -- ID do cliente no Asaas
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: vendas
-- ============================================================
create table public.vendas (
  id uuid default uuid_generate_v4() primary key,
  revendedora_id uuid references public.revendedoras(id) on delete cascade,
  pedido_id text not null, -- ID do pedido na Nuvemshop
  cliente_nome text,
  cliente_email text,
  produto_nome text not null,
  produto_foto text,
  valor_total decimal(10,2) not null,
  valor_comissao decimal(10,2) not null, -- 30% do valor_total
  status text default 'processando' check (status in ('processando', 'pago', 'cancelado', 'pendente')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: saques
-- ============================================================
create table public.saques (
  id uuid default uuid_generate_v4() primary key,
  revendedora_id uuid references public.revendedoras(id) on delete cascade,
  tipo text not null check (tipo in ('pix', 'credito_loja')),
  valor decimal(10,2) not null,
  chave_pix text,
  status text default 'solicitado' check (status in ('solicitado', 'processando', 'pago', 'recusado')),
  asaas_transfer_id text, -- ID da transferência no Asaas
  observacao text,
  criado_em timestamptz default now(),
  pago_em timestamptz
);

-- ============================================================
-- TABELA: notificacoes
-- ============================================================
create table public.notificacoes (
  id uuid default uuid_generate_v4() primary key,
  revendedora_id uuid references public.revendedoras(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  tipo text default 'info' check (tipo in ('info', 'venda', 'saque', 'aviso')),
  lida boolean default false,
  criado_em timestamptz default now()
);

-- ============================================================
-- RLS (Row Level Security) — cada revendedora vê só os seus dados
-- ============================================================
alter table public.revendedoras enable row level security;
alter table public.vendas enable row level security;
alter table public.saques enable row level security;
alter table public.notificacoes enable row level security;

-- Policies: revendedora só acessa seus próprios dados
create policy "revendedora_own" on public.revendedoras
  for all using (auth.uid() = user_id);

create policy "vendas_own" on public.vendas
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

create policy "saques_own" on public.saques
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

create policy "notificacoes_own" on public.notificacoes
  for all using (
    revendedora_id in (
      select id from public.revendedoras where user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTION: atualizar saldo ao confirmar venda
-- ============================================================
create or replace function public.confirmar_venda(venda_id uuid)
returns void language plpgsql security definer as $$
declare
  v_venda public.vendas;
begin
  select * into v_venda from public.vendas where id = venda_id;
  
  -- Atualiza status da venda
  update public.vendas set status = 'pago', atualizado_em = now()
    where id = venda_id;
  
  -- Credita comissão no saldo da revendedora
  update public.revendedoras
    set saldo_disponivel = saldo_disponivel + v_venda.valor_comissao,
        saldo_processando = saldo_processando - v_venda.valor_comissao,
        total_ganho = total_ganho + v_venda.valor_comissao,
        total_vendas = total_vendas + 1,
        atualizado_em = now()
    where id = v_venda.revendedora_id;
  
  -- Cria notificação
  insert into public.notificacoes (revendedora_id, titulo, mensagem, tipo)
    values (
      v_venda.revendedora_id,
      'Comissão creditada! 🎉',
      'Você recebeu R$' || v_venda.valor_comissao || ' pela venda de ' || v_venda.produto_nome,
      'venda'
    );
end;
$$;
