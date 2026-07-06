// POST /api/auth/pendente-logou
//
// Chamado pelo /auth/login após login bem-sucedido quando a revendedora
// tem status='pendente'. Notifica Gabriela por email pra ela conferir
// se rolou pagamento e ativar manual se necessário.
//
// Throttling simples: usa cache em memória do processo (ok pra Vercel
// serverless porque cada instância segura ~30min — evita spam mesmo
// em deploys).
//
// Body: { email: string }

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notificarPendenteLogou } from '@/lib/notifyAdmin'

export const dynamic = 'force-dynamic'

// Cache de últimas notificações (in-memory). Resetado a cada cold start.
// Suficiente pra evitar duplicatas em logins próximos.
const ultimaNotif = new Map<string, number>()
const COOLDOWN_MS = 60 * 60 * 1000 // 1h

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = (body?.email || '').toString().trim().toLowerCase()
    if (!email) return NextResponse.json({ ok: false })

    // Throttle: não notifica mais que 1x/hora pelo mesmo email
    const ultima = ultimaNotif.get(email) || 0
    if (Date.now() - ultima < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, ignored: 'cooldown' })
    }

    const supabase = supabaseAdmin()
    const { data: rev } = await supabase
      .from('revendedoras')
      .select('id, nome, email, status, criado_em')
      .ilike('email', email)
      .maybeSingle()

    if (!rev || rev.status !== 'pendente') {
      return NextResponse.json({ ok: true, ignored: 'não pendente' })
    }

    // Só notifica se cadastro foi nos últimos 7 dias (relevante)
    const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (new Date(rev.criado_em).getTime() < seteDias) {
      return NextResponse.json({ ok: true, ignored: 'cadastro antigo' })
    }

    await notificarPendenteLogou({
      nome: rev.nome,
      email: rev.email,
      cadastro_em: new Date(rev.criado_em).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    })

    ultimaNotif.set(email, Date.now())
    return NextResponse.json({ ok: true, notificada: true })
  } catch (e) {
    console.error('[pendente-logou] erro:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
