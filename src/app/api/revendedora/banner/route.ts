import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

const TIPOS_OK: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — banner pode ser maior que logo

export async function POST(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ erro: 'Envio inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })
  }

  const ext = TIPOS_OK[file.type]
  if (!ext) {
    return NextResponse.json(
      { erro: 'Formato inválido. Use PNG, JPG ou WEBP.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { erro: 'Imagem muito grande (máx. 5 MB).' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `${sessao.rev.id}-${Date.now()}.${ext}`

  const { error: upErro } = await sessao.admin.storage
    .from('banners')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })

  if (upErro) {
    console.error('Erro upload banner:', upErro)
    return NextResponse.json(
      {
        erro:
          'Não foi possível subir o banner. Verifique se o bucket "banners" existe e é público no Supabase.',
      },
      { status: 500 }
    )
  }

  const { data: pub } = sessao.admin.storage.from('banners').getPublicUrl(path)
  const bannerUrl = pub.publicUrl

  const { error: updErro } = await sessao.admin
    .from('revendedoras')
    .update({ banner_url: bannerUrl })
    .eq('id', sessao.rev.id)

  if (updErro) {
    return NextResponse.json(
      { erro: 'Banner subiu mas não salvou no perfil. Tente de novo.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ banner_url: bannerUrl })
}

// DELETE — remove banner (volta a usar foto auto-Tray)
export async function DELETE(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const { error } = await sessao.admin
    .from('revendedoras')
    .update({ banner_url: null })
    .eq('id', sessao.rev.id)
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
