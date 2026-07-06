-- Vídeo opcional da loja (YouTube ou link direto .mp4/.webm).
-- A revendedora cola a URL em "Personalizar minha loja"; aparece na vitrine
-- entre as categorias. null/'' => não mostra. Idempotente.
alter table revendedoras
  add column if not exists video_url text;
