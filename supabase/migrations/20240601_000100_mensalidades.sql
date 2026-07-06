-- ============================================================
-- Prata 15 — Mensalidade da loja (R$39,90/mês)
-- Ejecutar en: Supabase > SQL Editor (proyecto ipovxwzzqjjywratrbjx)
--
-- Regra: a revendedora paga a mensalidade pra manter a loja no ar.
-- Venceu e não pagou -> status='suspensa' (a loja já bloqueia sozinha
-- via /api/loja/[slug], que exige status='ativa').
-- ============================================================

-- 1) Colunas de controle
alter table public.revendedoras
  add column if not exists mensalidade_vence_em date;
alter table public.revendedoras
  add column if not exists mensalidade_isento boolean not null default false;

-- 2) Rollout SEGURO: quem já está ativa e sem data ganha 30 dias de
--    prazo, pra ninguém ser suspenso de imediato ao ligar o sistema.
update public.revendedoras
   set mensalidade_vence_em = current_date + 30
 where mensalidade_vence_em is null
   and status = 'ativa';

-- 3) Histórico de pagamentos/débitos de mensalidade
create table if not exists public.mensalidades_pagamentos (
  id              uuid primary key default gen_random_uuid(),
  revendedora_id  uuid references public.revendedoras(id) on delete cascade,
  valor           numeric(10,2) not null,
  metodo          text not null,          -- 'manual' | 'saldo'
  vence_novo      date,                   -- novo vencimento aplicado
  created_at      timestamptz not null default now(),
  created_by      text default 'admin'
);
create index if not exists idx_mens_pag_revendedora
  on public.mensalidades_pagamentos (revendedora_id);

alter table public.mensalidades_pagamentos enable row level security;
drop policy if exists "service_role_full_access" on public.mensalidades_pagamentos;
create policy "service_role_full_access"
  on public.mensalidades_pagamentos
  for all to service_role
  using (true) with check (true);
