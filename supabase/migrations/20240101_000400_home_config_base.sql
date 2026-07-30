-- ============================================================
-- 20240101_000400_home_config_base
-- ------------------------------------------------------------
-- Cria a tabela `home_config` — configuração global da home.
--
-- Padrão: **singleton** (só existe uma linha, id=1). Guarda um
-- blob jsonb com a configuração da home (banners, seções, etc).
-- Todos os 4 bancos têm esta tabela com o MESMO schema.
--
-- Schema derivado do dump real dos 4 bancos.
--
-- Drift observado (só nomenclatura, semanticamente igual):
--   - constraint check singleton: `home_config_singleton` (prata925,dona)
--     vs `home_config_id_check` (sp-folheados, outlet).
--   - policy: `home_config leitura publica`, `home_config_public_read`,
--     `home_config_pub` — todos SELECT to public.
-- Padronizamos aqui como `home_config_public_read`. Um cliente novo
-- criado por este repo terá o nome consistente.
--
-- Idempotente.
-- ============================================================

create table if not exists public.home_config (
  id          integer primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint home_config_singleton check (id = 1)
);

-- RLS: leitura pública (a home lê direto do client sem auth).
-- Escrita fica pra service_role (bypass automático).
alter table public.home_config enable row level security;

drop policy if exists "home_config_public_read" on public.home_config;
create policy "home_config_public_read"
  on public.home_config
  for select
  to public
  using (true);
