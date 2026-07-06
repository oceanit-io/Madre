// Mapeamento FIXO de fotos de capa por categoria. Usado em TODAS as lojas
// das revendedoras pra padronizar o visual da vitrine com fotos lifestyle
// (humanizadas), evitando que a vitrine fique cheia de fotos estúdio com
// fundo branco — que não destaca.
//
// As fotos vivem em /public/branding/categorias/*.jpg
//
// Pra adicionar/trocar uma foto:
//   1. Coloca o arquivo em /public/branding/categorias/
//   2. Mapeia o nome da categoria pro nome do arquivo aqui embaixo
//
// Fallback: se a categoria não tiver mapeamento aqui, o storefront usa
// a heurística dinâmica (escolhe a melhor foto disponível dos produtos).

const FOTOS_CATEGORIA: Record<string, string> = {
  // Brincos — foto da orelha com brincos
  'Brincos': '/branding/categorias/brincos.jpg',

  // Piercings — foto própria de piercing
  'Piercings': '/branding/categorias/piercings.jpg',

  // Pulseiras + Berloque — foto da pulseira com berloque "M"
  'Pulseiras': '/branding/categorias/pulseiras.jpg',
  'Pulseira': '/branding/categorias/pulseiras.jpg', // typo da Tray (singular)
  'Berloque': '/branding/categorias/pulseiras.jpg',

  // Braceletes — foto própria
  'Braceletes': '/branding/categorias/braceletes.jpg',

  // Correntes + Colares — foto do colar no pescoço
  'Corrente De Prata Feminina': '/branding/categorias/colares.jpg',
  'Correntes': '/branding/categorias/colares.jpg',
  'Colares': '/branding/categorias/colares.jpg',

  // Pingentes — foto própria
  'Pingentes': '/branding/categorias/pingentes.jpg',

  // Anéis — foto da mão com anéis empilhados
  'Aneis': '/branding/categorias/aneis.jpg',
  'Anéis': '/branding/categorias/aneis.jpg',

  // Tornozeleiras — foto própria
  'Tornozeleiras': '/branding/categorias/tornozeleiras.jpg',

  // Conjuntos — foto própria
  'Conjuntos': '/branding/categorias/conjuntos.jpg',
}

/**
 * Devolve a foto fixa configurada pra uma categoria, ou null se não existe
 * mapeamento (deixa o storefront usar fallback dinâmico).
 */
export function fotoFixaCategoria(categoria: string): string | null {
  return FOTOS_CATEGORIA[categoria] || null
}
