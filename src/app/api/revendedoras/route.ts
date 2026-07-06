import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = supabaseAdmin()

export async function POST(req: NextRequest) {
  try {
    const { nome, email, whatsapp, cidade, estado, revende } = await req.json()

    if (!nome || !email || !whatsapp || !cidade) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Email case-insensitive: normaliza pra minúsculas (gente digita de
    // qualquer jeito). Consulta e gravação usam essa versão.
    const emailNorm = String(email).trim().toLowerCase()

    // Verifica se e-mail já existe (case-insensitive)
    const { data: existe } = await supabase
      .from('revendedoras')
      .select('id')
      .ilike('email', emailNorm)
      .single()

    if (existe) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    // Gera subdomínio único
    const base = nome
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15)
    const subdominio = `${base}${Date.now().toString().slice(-4)}`

    // Salva lead no banco (status pendente — você aprova manualmente)
    const { data, error } = await supabase.from('revendedoras').insert({
      nome, email: emailNorm, whatsapp,
      cidade: cidade.split(',')[0]?.trim() || cidade,
      estado: cidade.split(',')[1]?.trim() || estado || '',
      subdominio,
      status: 'pendente',
      bio: `Olá! Sou ${nome.split(' ')[0]} e vendo joias de prata 925 com qualidade garantida. Entre em contato!`,
    }).select().single()

    if (error) {
      // Índice único revendedoras_email_lower_uniq: garante 1 conta por email
      // (case-insensitive) mesmo se a checagem ILIKE acima escapar numa corrida.
      if (error.code === '23505' || /duplicate key|revendedoras_email_lower_uniq/i.test(error.message || '')) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Erro ao salvar cadastro.' }, { status: 500 })
    }

    // Notifica via WhatsApp (opcional — use Twilio ou Z-API em produção)
    // await notificarWhatsApp(whatsapp, nome)

    return NextResponse.json({
      ok: true,
      mensagem: `Cadastro recebido! Entraremos em contato em até 2 dias úteis pelo WhatsApp ${whatsapp}.`,
      id: data.id,
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
