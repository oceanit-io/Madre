-- admin_alertas: avisos pro backoffice que precisam de ação manual.
-- Principal caso de uso: pagamento InfinitePay chegou via webhook mas o
-- sistema não conseguiu identificar a revendedora. Hoje só ia por email;
-- agora aparece também no dashboard como banner vermelho.

create table if not exists admin_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                    -- 'pagamento_sem_match', 'pendente_logou', etc
  titulo text not null,
  mensagem text,
  detalhes jsonb,                        -- payload bruto pra debug/contexto
  link text,                             -- pra onde ir quando clica (ex: /admin/ativar)
  lida boolean not null default false,
  lida_em timestamptz,
  lida_por text,                         -- quem marcou como lida (gabby/anderson/escritorio/master)
  criado_em timestamptz not null default now()
);

create index if not exists admin_alertas_lida_idx on admin_alertas (lida, criado_em desc);
create index if not exists admin_alertas_tipo_idx on admin_alertas (tipo);
