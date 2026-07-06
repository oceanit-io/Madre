-- ============================================================
-- 20240101_000200_produtos_base
-- ------------------------------------------------------------
-- Cria a tabela `produtos` (catálogo).
--
-- Motivação: `produtos` existe em TODOS os 4 bancos de produção,
-- é usada pelo código (vitrine, sync Tray, checkout) e pelas
-- migrations posteriores (destaque_tray, referencia, subcategoria,
-- variacoes, busca_unaccent). Mas nenhum SQL histórico do repo
-- criava ela — só existia porque foi criada à mão no dashboard.
-- Esta migration resolve a lacuna.
--
-- Fonte do schema: docs/DATABASE.md § tabelas principais.
-- Refinar contra dump real na Parte 2 (dump-schema.mjs) quando a
-- Management API do Supabase voltar.
--
-- Idempotente: create table if not exists, create index if not exists.
-- ============================================================

create table if not exists public.produtos (
  id                uuid primary key default gen_random_uuid(),
  sku               text unique not null,       -- = id da Tray
  nome              text not null,
  descricao         text,
  categoria         text,                       -- categoria pai (derivada do slug)
  preco             numeric(10,2) not null,
  preco_promo       numeric(10,2),
  peso_g            integer,
  estoque           integer default 0,
  fotos             text[],
  marca             text,
  modelo            text,
  ean               text,
  tamanho           text,
  cor               text,
  destaque          boolean default false,      -- curado manual
  lancamento        boolean default false,
  ativo             boolean default true,
  atualizado_em     timestamptz default now()
);

-- Índices básicos. Índices adicionais (busca full-text, estoque, etc.)
-- vêm nas migrations posteriores do bloco 2 (sync Tray).
create index if not exists idx_produtos_categoria on public.produtos (categoria);
create index if not exists idx_produtos_ativo     on public.produtos (ativo) where ativo = true;
