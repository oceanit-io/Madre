-- Audit log de ações admin (jun/2026).
-- Cada ação relevante feita no /admin é registrada com QUEM fez,
-- O QUÊ fez, em QUAL alvo, com QUAL detalhe extra, de QUAL IP.

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  quem text not null,                       -- 'gabby' | 'anderson' | 'escritorio' | 'master'
  acao text not null,                       -- ex: 'login', 'aprovar_revendedora', 'editar_pedido'
  alvo text,                                -- id ou descrição do alvo (uuid de pedido, slug de loja, etc)
  detalhes jsonb,                           -- payload livre pra contexto extra
  ip text,
  user_agent text,
  criado_em timestamptz not null default now()
);

create index if not exists admin_audit_log_quem_idx on admin_audit_log (quem);
create index if not exists admin_audit_log_acao_idx on admin_audit_log (acao);
create index if not exists admin_audit_log_criado_em_idx on admin_audit_log (criado_em desc);

-- Sem RLS — leitura/escrita só via service_role (server-side).
