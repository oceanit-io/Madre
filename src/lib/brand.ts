// ── Configuração central de marca (white-label) ─────────────────────────
//
// Este projeto é um motor multitenant de revendedoras que pode rodar para
// VÁRIAS marcas de prata. Tudo que é "nome da marca" sai DAQUI, não fica
// espalhado no código. Cada marca = uma instância (Vercel + Supabase +
// domínio próprios) que seta as envs NEXT_PUBLIC_BRAND_* — sem env, cai no
// default (Loja de Prata 925), então a instância atual não muda nada.
//
// IMPORTANTE: "prata 925" como MATERIAL (o metal, o produto) NÃO vem daqui.
// Isso é descrição do produto e continua igual pra qualquer marca de prata.
// Aqui só mora o que é IDENTIDADE da marca (nome, logo, domínio, fornecedor).
//
// Como abrir uma marca nova: ver docs/WHITE_LABEL.md.

export const brand = {
  // Nome comercial — títulos, e-mails, rodapés, políticas.
  nome: process.env.NEXT_PUBLIC_BRAND_NOME || 'Loja de Prata 925',

  // Logo textual: prefixo + destaque colorido (ex: "Prata" + "925").
  // Pra uma marca sem split visual, deixe o destaque vazio.
  logoPrefixo: process.env.NEXT_PUBLIC_BRAND_LOGO_PREFIXO || 'Prata',
  logoDestaque: process.env.NEXT_PUBLIC_BRAND_LOGO_DESTAQUE ?? '925',

  // Fornecedor/supplier que embala e despacha (copy da UI + políticas +
  // split). É a entidade que recebe a parte maior da venda.
  fornecedor: process.env.NEXT_PUBLIC_BRAND_FORNECEDOR || 'Prata 15',

  // Logo do fornecedor (selo "catálogo fornecido por"). Asset local —
  // cada marca troca o arquivo ou aponta pra outro caminho via env.
  fornecedorLogo: process.env.NEXT_PUBLIC_BRAND_FORNECEDOR_LOGO || '/branding/logo-p15.png',

  // Operadora legal da plataforma (rodapé, política de privacidade).
  operadora: process.env.NEXT_PUBLIC_BRAND_OPERADORA || 'Ocean IT',

  // Domínio público, SEM protocolo (ex: 'minhamarca.com.br').
  dominio: process.env.NEXT_PUBLIC_BRAND_DOMINIO || 'lojadeprata925.com.br',

  // URL completa do app (com https). Default usa a env já existente.
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://lojadeprata925.com.br',

  // Cor de destaque da marca (logo/acentos). Temas por loja continuam
  // configuráveis em lib/temasLoja — isto é só o default da marca.
  corDestaque: process.env.NEXT_PUBLIC_BRAND_COR || '#E8396A',

  // Fonte do catálogo:
  //   'tray'   → sincroniza automático da Tray (cron tray-sync).
  //   'manual' → produtos cadastrados à mão no admin (/admin/produtos),
  //              sem Tray. Esconde a UI específica de Tray.
  catalogo: (process.env.NEXT_PUBLIC_BRAND_CATALOGO || 'tray') as 'tray' | 'manual',
} as const

// Helpers de conveniência (evita repetir template strings pela base).
export const brandEmailFromNome = brand.nome
export const brandUrl = brand.url.replace(/\/$/, '')
