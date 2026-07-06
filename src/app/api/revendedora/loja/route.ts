import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'
import { TEMAS_LOJA, FONTES_LOJA, FUNDOS_LOJA, BANNERS_LOJA, HERO_TEXTO_CORES } from '@/lib/temasLoja'

export const dynamic = 'force-dynamic'

// Sanitiza handle de rede social: tira @, espaços, https://..., paths.
// Aceita só [a-zA-Z0-9._-] (max 40). Vazio => null (remove).
function limparHandle(v: unknown): string | null {
  if (typeof v !== 'string') return null
  let s = v.trim()
  if (!s) return null
  // Se colaram a URL inteira, tenta extrair o último segmento útil.
  s = s.replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, '')
  s = s.replace(/^@/, '').replace(/\/+$/, '').trim()
  // Pega só a parte antes de query/fragment.
  s = s.split(/[?#/]/)[0]
  if (!s) return null
  if (s.length > 40) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return null
  return s.toLowerCase()
}

export async function PATCH(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: {
    nome_loja?: string | null
    subdominio?: string | null
    cor_tema?: string | null
    fonte?: string | null
    cor_fundo?: string | null
    banner_preset?: string | null
    video_url?: string | null
    cinta_cor?: string | null
    mostrar_hero_texto?: boolean | null
    banner_overlay?: boolean | null
    hero_texto_cor?: string | null
    hero_titulo?: string | null
    hero_subtitulo?: string | null
    mostrar_bloco_prata925?: boolean | null
    mostrar_bloco_depoimentos?: boolean | null
    mostrar_bloco_garantias?: boolean | null
    bio?: string | null
    whatsapp_mensagem?: string | null
    instagram?: string | null
    tiktok?: string | null
    destaques_skus?: (string | number)[] | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const update: Record<string, string | boolean | null | string[]> = {}

  if (body.nome_loja !== undefined) {
    const nome = (body.nome_loja || '').trim()
    if (nome.length > 60) {
      return NextResponse.json({ erro: 'Nome da loja muito longo' }, { status: 400 })
    }
    update.nome_loja = nome || null
  }

  // URL da loja (slug). Strict: 3-30 chars, lowercase, a-z 0-9 e hifens.
  // Bloqueia palavras reservadas que conflitam com rotas reais do app.
  if (body.subdominio !== undefined && body.subdominio !== null) {
    const slug = (body.subdominio || '').toString().trim().toLowerCase()
    if (slug.length < 3 || slug.length > 30) {
      return NextResponse.json({ erro: 'URL deve ter entre 3 e 30 caracteres' }, { status: 400 })
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ erro: 'URL pode ter só letras (a-z), números e hífens (não no começo/fim)' }, { status: 400 })
    }
    const reservadas = new Set([
      'admin', 'api', 'auth', 'app', 'login', 'logout', 'register', 'cadastro',
      'dashboard', 'painel', 'perfil', 'configurar-loja', 'configurar', 'vendas',
      'saldo', 'carrinho', 'checkout', 'pedido', 'pedidos', 'produto', 'produtos',
      'loja', 'lojas', 'home', 'help', 'ajuda', 'sobre', 'contato', 'suporte',
      'pagbank', 'pagarme', 'webhook', 'static', '_next', 'www', 'public',
    ])
    if (reservadas.has(slug)) {
      return NextResponse.json({ erro: 'Essa URL é reservada. Escolhe outra.' }, { status: 400 })
    }
    // Confere que ninguém mais tem esse slug
    const { data: existe } = await sessao.admin
      .from('revendedoras')
      .select('id')
      .eq('subdominio', slug)
      .neq('id', sessao.rev.id)
      .maybeSingle()
    if (existe) {
      return NextResponse.json({ erro: 'Essa URL já está em uso. Escolhe outra.' }, { status: 409 })
    }
    update.subdominio = slug
  }

  if (body.cor_tema !== undefined) {
    if (body.cor_tema === null || body.cor_tema === '') {
      update.cor_tema = null
    } else {
      const ok = TEMAS_LOJA.some(t => t.cor.toLowerCase() === String(body.cor_tema).toLowerCase())
      if (!ok) {
        return NextResponse.json({ erro: 'Cor inválida' }, { status: 400 })
      }
      update.cor_tema = body.cor_tema
    }
  }

  if (body.fonte !== undefined) {
    if (body.fonte === null || body.fonte === '') {
      update.fonte = null
    } else {
      const ok = FONTES_LOJA.some(f => f.id === body.fonte)
      if (!ok) {
        return NextResponse.json({ erro: 'Fonte inválida' }, { status: 400 })
      }
      update.fonte = body.fonte
    }
  }

  if (body.cor_fundo !== undefined) {
    if (body.cor_fundo === null || body.cor_fundo === '') {
      update.cor_fundo = null
    } else {
      const ok = FUNDOS_LOJA.some(f => f.id === body.cor_fundo)
      if (!ok) {
        return NextResponse.json({ erro: 'Cor de fundo inválida' }, { status: 400 })
      }
      update.cor_fundo = body.cor_fundo
    }
  }

  if (body.banner_preset !== undefined) {
    if (body.banner_preset === null || body.banner_preset === '') {
      update.banner_preset = null
    } else {
      const ok = BANNERS_LOJA.some(b => b.id === body.banner_preset)
      if (!ok) {
        return NextResponse.json({ erro: 'Banner inválido' }, { status: 400 })
      }
      update.banner_preset = body.banner_preset
    }
  }

  if (body.mostrar_hero_texto !== undefined) {
    update.mostrar_hero_texto = body.mostrar_hero_texto === null ? null : Boolean(body.mostrar_hero_texto)
  }

  if (body.banner_overlay !== undefined) {
    update.banner_overlay = body.banner_overlay === null ? null : Boolean(body.banner_overlay)
  }

  if (body.hero_texto_cor !== undefined) {
    if (body.hero_texto_cor === null || body.hero_texto_cor === '') {
      update.hero_texto_cor = null
    } else {
      const ok = HERO_TEXTO_CORES.some(c => c.id === body.hero_texto_cor)
      if (!ok) {
        return NextResponse.json({ erro: 'Cor do texto do hero inválida' }, { status: 400 })
      }
      update.hero_texto_cor = body.hero_texto_cor
    }
  }

  if (body.cinta_cor !== undefined) {
    if (body.cinta_cor === null || body.cinta_cor === '') {
      update.cinta_cor = null
    } else {
      const ok = TEMAS_LOJA.some(t => t.cor.toLowerCase() === String(body.cinta_cor).toLowerCase())
      if (!ok) {
        return NextResponse.json({ erro: 'Cor da cinta inválida' }, { status: 400 })
      }
      update.cinta_cor = body.cinta_cor
    }
  }

  if (body.video_url !== undefined) {
    const v = (body.video_url || '').trim()
    if (!v) {
      update.video_url = null
    } else if (!/^https?:\/\//i.test(v) || v.length > 500) {
      return NextResponse.json({ erro: 'Link de vídeo inválido' }, { status: 400 })
    } else {
      update.video_url = v
    }
  }

  if (body.hero_titulo !== undefined) {
    const t = (body.hero_titulo || '').trim()
    if (t.length > 80) {
      return NextResponse.json({ erro: 'Título do banner muito longo (máx 80)' }, { status: 400 })
    }
    update.hero_titulo = t || null
  }

  if (body.hero_subtitulo !== undefined) {
    const t = (body.hero_subtitulo || '').trim()
    if (t.length > 80) {
      return NextResponse.json({ erro: 'Subtítulo do banner muito longo (máx 80)' }, { status: 400 })
    }
    update.hero_subtitulo = t || null
  }

  if (body.mostrar_bloco_prata925 !== undefined) {
    update.mostrar_bloco_prata925 = body.mostrar_bloco_prata925 === null ? null : Boolean(body.mostrar_bloco_prata925)
  }
  if (body.mostrar_bloco_depoimentos !== undefined) {
    update.mostrar_bloco_depoimentos = body.mostrar_bloco_depoimentos === null ? null : Boolean(body.mostrar_bloco_depoimentos)
  }
  if (body.mostrar_bloco_garantias !== undefined) {
    update.mostrar_bloco_garantias = body.mostrar_bloco_garantias === null ? null : Boolean(body.mostrar_bloco_garantias)
  }

  if (body.bio !== undefined) {
    const bio = (body.bio || '').trim()
    if (bio.length > 280) {
      return NextResponse.json({ erro: 'Bio muito longa (máx 280)' }, { status: 400 })
    }
    update.bio = bio || null
  }

  if (body.whatsapp_mensagem !== undefined) {
    const msg = (body.whatsapp_mensagem || '').trim()
    if (msg.length > 280) {
      return NextResponse.json({ erro: 'Mensagem do WhatsApp muito longa (máx 280)' }, { status: 400 })
    }
    update.whatsapp_mensagem = msg || null
  }

  if (body.instagram !== undefined) {
    update.instagram = body.instagram === null || body.instagram === '' ? null : limparHandle(body.instagram)
    if (body.instagram && update.instagram === null) {
      return NextResponse.json({ erro: 'Instagram inválido' }, { status: 400 })
    }
  }

  if (body.tiktok !== undefined) {
    update.tiktok = body.tiktok === null || body.tiktok === '' ? null : limparHandle(body.tiktok)
    if (body.tiktok && update.tiktok === null) {
      return NextResponse.json({ erro: 'TikTok inválido' }, { status: 400 })
    }
  }

  // Destaques escolhidos pela revendedora: lista de SKUs (ordenada). null/[] =
  // volta pros destaques padrão. Sanitiza (só SKU válido), tira repetidos,
  // máx 12. Server-first: nunca confia no formato vindo do client.
  if (body.destaques_skus !== undefined) {
    if (body.destaques_skus === null || (Array.isArray(body.destaques_skus) && body.destaques_skus.length === 0)) {
      update.destaques_skus = null
    } else if (Array.isArray(body.destaques_skus)) {
      const skus = Array.from(new Set(
        body.destaques_skus
          .map(s => String(s).trim())
          .filter(s => /^[A-Za-z0-9_-]{1,40}$/.test(s))
      )).slice(0, 12)
      update.destaques_skus = skus
    } else {
      return NextResponse.json({ erro: 'Destaques inválidos' }, { status: 400 })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ erro: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await sessao.admin
    .from('revendedoras')
    .update(update)
    .eq('id', sessao.rev.id)
    .select('nome_loja, subdominio, cor_tema, fonte, cor_fundo, foto_url, banner_url, bio, whatsapp_mensagem, instagram, tiktok, hero_titulo, hero_subtitulo')
    .single()

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao salvar', detalhes: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
