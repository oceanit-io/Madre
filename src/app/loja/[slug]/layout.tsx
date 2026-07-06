import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { brand } from '@/lib/brand'

// Metadata da loja da revendedora (preview de link no WhatsApp/Insta/etc).
// ANTES herdava o metadata do layout raiz ("<marca> · Revendedoras" + descrição
// genérica) — então o link compartilhado mostrava "Revendedoras" em vez do nome
// que a revendedora escolheu. Aqui montamos o preview com o NOME da loja dela.
export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  try {
    const supabase = supabaseAdmin()
    const { data } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, bio, foto_url, hero_titulo, hero_subtitulo, status')
      .eq('subdominio', params.slug)
      .maybeSingle()

    if (data && data.status === 'ativa') {
      // Nome que a revendedora escolheu pra própria loja.
      const nomeLoja = (data.nome_loja || data.hero_titulo || data.nome || '').trim()
      const titulo = nomeLoja || brand.nome
      // Descrição = bio/subtítulo da própria revendedora. SEM o texto genérico
      // de "Revendedoras". Se ela não escreveu nada, fica só o nome da loja.
      const descricao = (data.bio || data.hero_subtitulo || '').trim() || nomeLoja
      const imagem = data.foto_url || undefined

      return {
        title: titulo,
        description: descricao,
        openGraph: {
          title: titulo,
          description: descricao,
          type: 'website',
          ...(imagem ? { images: [{ url: imagem }] } : {}),
        },
        twitter: {
          card: imagem ? 'summary_large_image' : 'summary',
          title: titulo,
          description: descricao,
          ...(imagem ? { images: [imagem] } : {}),
        },
      }
    }
  } catch (e) {
    console.error('[loja metadata] falhou:', e)
  }
  // Fallback (loja não encontrada/inativa): só o nome da marca, sem "Revendedoras".
  return { title: brand.nome }
}

export default function LojaLayout({ children }: { children: ReactNode }) {
  return children
}
