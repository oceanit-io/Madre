import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

const TIPOS_OK: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const MAX_BYTES = 3 * 1024 * 1024 // 3 MB

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
      { erro: 'Imagem muito grande (máx. 3 MB).' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `${sessao.rev.id}-${Date.now()}.${ext}`

  const { error: upErro } = await sessao.admin.storage
    .from('logos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })

  if (upErro) {
    console.error('Erro upload logo:', upErro)
    return NextResponse.json(
      {
        erro:
          'Não foi possível subir o logo. Verifique se o bucket "logos" existe e é público no Supabase.',
      },
      { status: 500 }
    )
  }

  const { data: pub } = sessao.admin.storage.from('logos').getPublicUrl(path)
  const fotoUrl = pub.publicUrl

  const { error: updErro } = await sessao.admin
    .from('revendedoras')
    .update({ foto_url: fotoUrl })
    .eq('id', sessao.rev.id)

  if (updErro) {
    return NextResponse.json(
      { erro: 'Logo subiu mas não salvou no perfil. Tente de novo.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ foto_url: fotoUrl })
}
