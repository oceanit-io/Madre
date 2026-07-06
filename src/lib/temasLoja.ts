// Cores base que a revendedora pode escolher para a sua loja.
// Aplicadas em acentos (nome da loja, badges, botões, avatar) — o fundo
// continua claro e os textos legíveis. NULL/!válido => padrão preto.

export const COR_PADRAO = '#1A1A1A'

export type TemaLoja = { nome: string; cor: string }

// Paleta comercial pra joia: tons clássicos (preto/vinho/dourado),
// vibrantes (pink/azul/verde), e nudes/joia (champagne/nude/ônix).
// Todas legíveis com texto branco em botões/hero/badges.
export const TEMAS_LOJA: TemaLoja[] = [
  // Clássicos
  { nome: 'Preto clássico',    cor: '#1A1A1A' },
  { nome: 'Vinho',             cor: '#9D2449' },
  { nome: 'Ônix',              cor: '#36454F' },
  { nome: 'Café',              cor: '#6F4E37' },
  // Joia / nudes
  { nome: 'Dourado escuro',    cor: '#8A6D1D' },
  { nome: 'Champagne',         cor: '#B38B5D' },
  { nome: 'Rosê',              cor: '#C97B7B' },
  { nome: 'Nude rosado',       cor: '#C69A8B' },
  { nome: 'Terracota',         cor: '#B45309' },
  // Femininos
  { nome: 'Rosa',              cor: '#E8396A' },
  { nome: 'Pink choque',       cor: '#EC4899' },
  { nome: 'Magenta',           cor: '#C026D3' },
  { nome: 'Lavanda',           cor: '#8B5CF6' },
  { nome: 'Roxo',              cor: '#6D28D9' },
  { nome: 'Roxo vibrante',     cor: '#7C3AED' },
  // Frios
  { nome: 'Azul marinho',      cor: '#1E3A8A' },
  { nome: 'Azul elétrico',     cor: '#2563EB' },
  { nome: 'Azul céu',          cor: '#0EA5E9' },
  { nome: 'Turquesa',          cor: '#14B8A6' },
  { nome: 'Verde esmeralda',   cor: '#0F766E' },
  { nome: 'Verde sage',        cor: '#5E8B5C' },
  { nome: 'Verde vibrante',    cor: '#16A34A' },
  // Quentes
  { nome: 'Laranja vibrante',  cor: '#F97316' },
  { nome: 'Coral',             cor: '#F87171' },
  { nome: 'Vermelho',          cor: '#EF4444' },
  { nome: 'Bordô',             cor: '#7F1D1D' },
]

// Só aceita um hex da paleta (ou variações hex válidas). Senão, padrão.
export function corValida(cor: string | null | undefined): string {
  if (cor && /^#[0-9a-fA-F]{6}$/.test(cor)) return cor
  return COR_PADRAO
}

// ============================================================
// Tipografia da loja — fontes comerciais bem conhecidas, focadas
// em joalheria/moda. Todas carregadas via Google Fonts no layout.tsx.
// ============================================================

export type FonteLoja = {
  id: string         // chave armazenada em revendedoras.fonte
  nome: string       // rótulo visível p/ a revendedora
  descricao: string  // ajuda no picker
  cssFamily: string  // pronto p/ fontFamily inline
}

export const FONTES_LOJA: FonteLoja[] = [
  {
    id: 'playfair',
    nome: 'Elegante',
    descricao: 'Playfair Display — serifa clássica de joalheria',
    cssFamily: "'Playfair Display', Georgia, serif",
  },
  {
    id: 'cormorant',
    nome: 'Boutique',
    descricao: 'Cormorant Garamond — serifa fina e refinada',
    cssFamily: "'Cormorant Garamond', Georgia, serif",
  },
  {
    id: 'dmserif',
    nome: 'Editorial',
    descricao: 'DM Serif Display — alta moda, capa de revista',
    cssFamily: "'DM Serif Display', Georgia, serif",
  },
  {
    id: 'bodoni',
    nome: 'Couture',
    descricao: 'Bodoni Moda — fashion luxury italiano',
    cssFamily: "'Bodoni Moda', Georgia, serif",
  },
  {
    id: 'cinzel',
    nome: 'Luxo',
    descricao: 'Cinzel — maiúsculas romanas, premium',
    cssFamily: "'Cinzel', Georgia, serif",
  },
  {
    id: 'italiana',
    nome: 'Delicada',
    descricao: 'Italiana — linhas finas, feminina',
    cssFamily: "'Italiana', Georgia, serif",
  },
  {
    id: 'marcellus',
    nome: 'Clássica',
    descricao: 'Marcellus — romana atemporal',
    cssFamily: "'Marcellus', Georgia, serif",
  },
  {
    id: 'lora',
    nome: 'Romântica',
    descricao: 'Lora — serifa quente e legível',
    cssFamily: "'Lora', Georgia, serif",
  },
  {
    id: 'montserrat',
    nome: 'Moderna',
    descricao: 'Montserrat — sans-serif geométrica',
    cssFamily: "'Montserrat', sans-serif",
  },
  {
    id: 'poppins',
    nome: 'Amigável',
    descricao: 'Poppins — sans-serif arredondada, suave',
    cssFamily: "'Poppins', sans-serif",
  },
  {
    id: 'inter',
    nome: 'Minimalista',
    descricao: 'Inter — sans-serif clean tech',
    cssFamily: "'Inter', sans-serif",
  },
  {
    id: 'allura',
    nome: 'Caligrafia',
    descricao: 'Allura — script manuscrito elegante',
    cssFamily: "'Allura', 'Brush Script MT', cursive",
  },
  {
    id: 'greatvibes',
    nome: 'Manuscrita',
    descricao: 'Great Vibes — script romântico (joia)',
    cssFamily: "'Great Vibes', 'Brush Script MT', cursive",
  },
  {
    id: 'dancingscript',
    nome: 'Assinatura',
    descricao: 'Dancing Script — script suave, vivo',
    cssFamily: "'Dancing Script', 'Brush Script MT', cursive",
  },
]

// Padrão = Elegante (Playfair) — é o que a storefront usava antes
// da personalização, então lojas antigas não mudam ao incluir o campo.
export const FONTE_PADRAO: FonteLoja = FONTES_LOJA[0]

export function fonteValida(id: string | null | undefined): FonteLoja {
  return FONTES_LOJA.find(f => f.id === id) || FONTE_PADRAO
}

// ============================================================
// Cor de fundo da loja (lista fechada). Mantém contraste OK com
// texto escuro e cor de acento — sem cores arbitrárias p/ não ter
// stores ilegíveis. Tudo são tons CLAROS pra cards/fotos respirarem.
// ============================================================

export type FundoLoja = {
  id: string
  nome: string
  hex: string
}

// Por hoje só fundos CLAROS — assim o texto/cards/destaques existentes
// continuam funcionando sem ajuste de contraste por variante. Modo
// escuro fica como melhoria futura.
export const FUNDOS_LOJA: FundoLoja[] = [
  { id: 'claro',  nome: 'Off-white',    hex: '#FAFAFA' }, // padrão atual
  { id: 'creme',  nome: 'Creme',        hex: '#FAF6EE' },
  { id: 'rosa',   nome: 'Rosa pó',      hex: '#FFF4F5' },
  { id: 'cinza',  nome: 'Cinza claro',  hex: '#F3F4F6' },
  { id: 'beje',   nome: 'Bege suave',   hex: '#F5F1E8' },
]

export const FUNDO_PADRAO: FundoLoja = FUNDOS_LOJA[0]

export function fundoValido(id: string | null | undefined): FundoLoja {
  return FUNDOS_LOJA.find(f => f.id === id) || FUNDO_PADRAO
}

// ============================================================
// Banners de design (mesh/degradê premium animado) p/ o hero da loja.
// A revendedora escolhe um. 'vibrante' = usa a COR da loja (gradiente
// padrão). Os demais são paletas fixas lindas. Prioridade no hero:
// foto enviada (banner_url) > preset escolhido > 'vibrante'.
// ============================================================

export type BannerLoja = {
  id: string
  nome: string
  // Aplicado como `background` do hero. '' => usa a cor da loja (padrão).
  css: string
}

export const BANNERS_LOJA: BannerLoja[] = [
  { id: 'vibrante', nome: 'Vibrante (cor da loja)', css: '' },
  {
    id: 'aurora',
    nome: 'Aurora',
    css: 'radial-gradient(at 18% 22%, #EC4899 0%, transparent 52%), radial-gradient(at 82% 8%, #7C3AED 0%, transparent 50%), radial-gradient(at 60% 88%, #2563EB 0%, transparent 55%), linear-gradient(135deg, #6D28D9, #1E3A8A)',
  },
  {
    id: 'porsol',
    nome: 'Pôr do sol',
    css: 'radial-gradient(at 0% 0%, #F97316 0%, transparent 55%), radial-gradient(at 92% 18%, #EC4899 0%, transparent 50%), radial-gradient(at 50% 100%, #7C3AED 0%, transparent 55%), linear-gradient(135deg, #DB2777, #7C3AED)',
  },
  {
    id: 'oceano',
    nome: 'Oceano',
    css: 'radial-gradient(at 10% 20%, #0EA5E9 0%, transparent 55%), radial-gradient(at 90% 8%, #14B8A6 0%, transparent 52%), radial-gradient(at 62% 92%, #2563EB 0%, transparent 55%), linear-gradient(135deg, #0EA5E9, #0F766E)',
  },
  {
    id: 'luxo',
    nome: 'Luxo',
    css: 'radial-gradient(at 80% 12%, #B8902F 0%, transparent 55%), radial-gradient(at 12% 88%, #8A6D1D 0%, transparent 50%), linear-gradient(135deg, #1A1A1A, #2e2611)',
  },
]

export const BANNER_PADRAO: BannerLoja = BANNERS_LOJA[0]

export function bannerValido(id: string | null | undefined): BannerLoja {
  return BANNERS_LOJA.find(b => b.id === id) || BANNER_PADRAO
}

// ============================================================
// Cor do TEXTO no hero/banner. Antes era sempre branco — agora a
// revendedora escolhe: branco (padrão), preto (banners claros),
// dourado (luxo), ou a própria cor da loja.
// ============================================================

export type HeroTextoCor = {
  id: string
  nome: string
  hex: string        // hex puro p/ aplicar via inline style. Em runtime
                     // 'cor_da_loja' resolve pro cor_tema da revendedora.
}

export const HERO_TEXTO_CORES: HeroTextoCor[] = [
  { id: 'branco',       nome: 'Branco',           hex: '#FFFFFF' },
  { id: 'preto',        nome: 'Preto',            hex: '#1A1A1A' },
  { id: 'dourado',      nome: 'Dourado',          hex: '#D4AF37' },
  { id: 'champagne',    nome: 'Champagne',        hex: '#E6D5B8' },
  { id: 'cor_da_loja',  nome: 'Cor da loja',      hex: '' }, // resolve em runtime
]

export const HERO_TEXTO_COR_PADRAO = HERO_TEXTO_CORES[0]

export function heroTextoCorValida(id: string | null | undefined): HeroTextoCor {
  return HERO_TEXTO_CORES.find(c => c.id === id) || HERO_TEXTO_COR_PADRAO
}

// Resolve a cor REAL a usar (em runtime), levando em conta que
// 'cor_da_loja' precisa do hex da cor_tema da revendedora.
export function heroTextoHexReal(id: string | null | undefined, corDaLoja: string): string {
  const c = heroTextoCorValida(id)
  return c.id === 'cor_da_loja' ? corDaLoja : c.hex
}
