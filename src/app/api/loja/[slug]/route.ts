import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Não cachear: precisamos rodar a cada carga pra contar a visita.
export const dynamic = 'force-dynamic'

function classificarUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const u = (ua || '').toLowerCase()
  if (/tablet|ipad/.test(u)) return 'tablet'
  if (/mobi|android|iphone/.test(u)) return 'mobile'
  return 'desktop'
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = supabaseAdmin()

  // maybeSingle: 0 linhas NÃO vira erro (data=null, error=null). Assim
  // distinguimos "loja não existe" (404) de "erro transitório de banco" (503).
  // Antes usava .single() e qualquer blip do Supabase virava 404 "não
  // encontrada" numa loja que EXISTE — daí o "loja indisponível" que sumia
  // ao recarregar.
  const { data, error } = await supabase
    .from('revendedoras')
    .select('id, nome, nome_loja, whatsapp, whatsapp_mensagem, cidade, estado, foto_url, bio, status, subdominio, cor_tema, fonte, cor_fundo, banner_url, banner_preset, video_url, cinta_cor, mostrar_hero_texto, banner_overlay, hero_texto_cor, hero_titulo, hero_subtitulo, mostrar_bloco_prata925, mostrar_bloco_depoimentos, mostrar_bloco_garantias, instagram, tiktok, destaques_skus')
    .eq('subdominio', params.slug)
    .maybeSingle()

  if (error) {
    // Erro real de banco (transitório): 503 pro client reintentar, NÃO 404.
    console.error('[loja] erro ao buscar revendedora:', error.message)
    return NextResponse.json({ erro: 'Indisponível no momento' }, { status: 503 })
  }
  if (!data) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  if (data.status !== 'ativa') {
    return NextResponse.json({
      erro: 'Loja inativa',
      status_revendedora: data.status,
      nome: data.nome,
    }, { status: 403 })
  }

  // Conta a visita à loja (anônimo, sem PII). pagina = 'loja/<slug>' permite
  // agregar por revendedora no dashboard dela. Best-effort: nunca trava a loja.
  try {
    const ua = request.headers.get('user-agent') || ''
    const referrer = (request.headers.get('referer') || '').slice(0, 200) || null
    await supabase.from('visitas').insert({
      pagina: `loja/${params.slug}`.slice(0, 40),
      user_agent_short: classificarUA(ua),
      sessao: null,
      referrer,
    })
  } catch (e) {
    console.error('[loja] falha ao contar visita:', e)
  }

  return NextResponse.json(data)
}
