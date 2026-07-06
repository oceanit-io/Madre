import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { syncTray } from '@/lib/traySync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Hobby limita a 60s; em planos maiores usa mais

// Sync Tray → Supabase.
// - Cron Vercel (1x/dia): roda POR PADRÃO. Atualiza os "mais vendidos" da
//   Tray (campo `hot` -> destaque_tray) que viram os destaques das lojas,
//   além de preço/estoque/fotos. Kill-switch: TRAY_SYNC_ENABLED='0' desliga.
// - Admin: roda sempre — botão manual. `?dry=1` = pré-visualização (NÃO
//   escreve, devolve amostra do mapeamento).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  const ehAdmin = checkAdminAuth(request)
  const ehCron =
    (!!cronSecret && auth === `Bearer ${cronSecret}`) ||
    request.headers.get('x-vercel-cron') === '1'

  if (!ehAdmin && !ehCron) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const dry = new URL(request.url).searchParams.get('dry') === '1'

  // Sync automático LIGADO por padrão (destaques/best-sellers atualizam todo
  // dia). Kill-switch de emergência: TRAY_SYNC_ENABLED='0' desliga.
  if (ehCron && !ehAdmin && process.env.TRAY_SYNC_ENABLED === '0') {
    return NextResponse.json({
      ok: true,
      skipped: 'TRAY_SYNC_ENABLED=0 (sync automático desligado manualmente)',
    })
  }

  try {
    const r = await syncTray({ dry })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[tray-sync] erro:', e)
    return NextResponse.json(
      { erro: 'Falha no sync', detalhe: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
