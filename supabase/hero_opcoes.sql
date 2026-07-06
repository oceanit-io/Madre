-- Opções do hero/banner que a revendedora controla:
-- mostrar_hero_texto: se exibe o eyebrow + título + bio sobre o banner (default true).
-- banner_overlay:     se aplica o degradê escurecedor sobre a foto enviada (default true).
-- Idempotente.
alter table revendedoras
  add column if not exists mostrar_hero_texto boolean not null default true,
  add column if not exists banner_overlay boolean not null default true;
