-- ============================================================
-- Cor do texto do hero (título + bio) na vitrine da revendedora
-- ============================================================
-- Antes o texto do hero era sempre branco. Agora a revendedora escolhe:
-- branco (padrão), preto, dourado, champagne, ou a cor da loja.
-- Lista fechada validada em lib/temasLoja.heroTextoCorValida(). NULL =
-- branco (padrão histórico).

alter table public.revendedoras
  add column if not exists hero_texto_cor text;
