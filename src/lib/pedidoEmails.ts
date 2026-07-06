// E-mails disparados quando o status de um pedido muda (pago / enviado).
// Best-effort por design: NUNCA lança — uma falha de e-mail não pode
// quebrar o update do pedido nem o webhook. Reusado pelo admin PATCH e
// pelo webhook do PagBank.
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enviarEmail } from './email'
import {
  pagamentoConfirmadoClienteEmail,
  pedidoEnviadoClienteEmail,
  pagamentoRevendedoraEmail,
} from './emailTemplates'

type Supa = ReturnType<typeof supabaseAdmin>

export type PedidoParaEmail = {
  id?: string
  numero_pedido: string
  cliente_nome: string | null
  cliente_email: string | null
  total: number | null
  slug_revendedora: string | null
  codigo_rastreio?: string | null
}

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://lojadeprata925.com.br').replace(/\/$/, '')

// Envia ao CLIENTE o e-mail de rastreio (código + link Correios + página de
// acompanhamento) assim que a revendedora cadastra/atualiza o código de
// rastreamento no painel dela. Best-effort: nunca lança. Reusa o mesmo template
// "pedido enviado". Chamado pelo PATCH /api/revendedora/pedidos/[id]/rastreio.
export async function emailRastreioAoCliente(
  supabase: Supa,
  pedido: PedidoParaEmail
): Promise<void> {
  try {
    const clienteEmail = (pedido.cliente_email || '').trim()
    const cod = (pedido.codigo_rastreio || '').trim()
    if (!clienteEmail || !cod) return

    // Revendedora p/ nome + link de WhatsApp (cliente tirar dúvida do envio).
    let rev: { nome: string | null; whatsapp: string | null } | null = null
    if (pedido.slug_revendedora) {
      const { data } = await supabase
        .from('revendedoras')
        .select('nome, whatsapp')
        .eq('subdominio', pedido.slug_revendedora)
        .single()
      rev = data || null
    }
    let waLink: string | null = null
    const w = (rev?.whatsapp || '').replace(/\D/g, '')
    if (w) {
      const msg = encodeURIComponent(`Olá! Sobre o meu pedido ${pedido.numero_pedido} na sua loja 💎`)
      waLink = `https://wa.me/55${w}?text=${msg}`
    }

    const c = pedidoEnviadoClienteEmail({
      numeroPedido: pedido.numero_pedido,
      nome: pedido.cliente_nome || '',
      revNome: rev?.nome || null,
      waLink,
      codigoRastreio: cod,
      pedidoUrl: pedido.id ? `${APP_URL}/pedido/${pedido.id}` : null,
    })
    await enviarEmail({ to: clienteEmail, subject: c.subject, html: c.html })
  } catch (e) {
    console.error('[pedidoEmails] falha ao enviar e-mail de rastreio ao cliente:', e)
  }
}

export async function emailsAoMudarStatus(
  supabase: Supa,
  pedido: PedidoParaEmail,
  novoStatus: string
): Promise<void> {
  try {
    if (novoStatus !== 'pago' && novoStatus !== 'enviado') return

    const clienteEmail = (pedido.cliente_email || '').trim()
    const total = Number(pedido.total) || 0

    // Revendedora (id/nome/email/whatsapp) p/ notificar e montar o link de contato.
    let rev: { id: string | null; nome: string | null; email: string | null; whatsapp: string | null } | null = null
    if (pedido.slug_revendedora) {
      const { data } = await supabase
        .from('revendedoras')
        .select('id, nome, email, whatsapp')
        .eq('subdominio', pedido.slug_revendedora)
        .single()
      rev = data || null
    }

    // wa.me da revendedora p/ o cliente falar (se houver whatsapp).
    let waLink: string | null = null
    const w = (rev?.whatsapp || '').replace(/\D/g, '')
    if (w) {
      const msg = encodeURIComponent(
        `Olá! Sobre o meu pedido ${pedido.numero_pedido} na sua loja 💎`
      )
      waLink = `https://wa.me/55${w}?text=${msg}`
    }

    if (novoStatus === 'pago') {
      if (clienteEmail) {
        const c = pagamentoConfirmadoClienteEmail({
          numeroPedido: pedido.numero_pedido,
          nome: pedido.cliente_nome || '',
          total,
          waLink,
        })
        await enviarEmail({ to: clienteEmail, subject: c.subject, html: c.html })
      }
      if (rev?.email) {
        const r = pagamentoRevendedoraEmail({
          numeroPedido: pedido.numero_pedido,
          revNome: rev.nome || '',
          clienteNome: pedido.cliente_nome || '',
          total,
        })
        await enviarEmail({ to: rev.email, subject: r.subject, html: r.html })
      }
    } else if (novoStatus === 'enviado') {
      if (clienteEmail) {
        const c = pedidoEnviadoClienteEmail({
          numeroPedido: pedido.numero_pedido,
          nome: pedido.cliente_nome || '',
          revNome: rev?.nome || null,
          waLink,
          codigoRastreio: pedido.codigo_rastreio || null,
          pedidoUrl: pedido.id ? `${APP_URL}/pedido/${pedido.id}` : null,
        })
        await enviarEmail({ to: clienteEmail, subject: c.subject, html: c.html })
      }
    }

    // Notificação NO PAINEL da revendedora (sino), não só e-mail. A
    // revendedora acompanha tudo de dentro do dashboard. Best-effort.
    if (rev?.id) {
      const primeiro = (rev.nome || '').split(' ')[0] || 'você'
      const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      if (novoStatus === 'pago') {
        await supabase.from('notificacoes').insert({
          revendedora_id: rev.id,
          titulo: '💰 Pagamento confirmado!',
          mensagem: `${primeiro}, o pagamento do pedido ${pedido.numero_pedido} (${totalFmt}) foi confirmado. Sua comissão já está sendo processada! 🎉`,
          tipo: 'venda',
        })
      } else if (novoStatus === 'enviado') {
        const cli = (pedido.cliente_nome || '').split(' ')[0]
        await supabase.from('notificacoes').insert({
          revendedora_id: rev.id,
          titulo: '📦 Pedido enviado!',
          mensagem: `O pedido ${pedido.numero_pedido}${cli ? ` da ${cli}` : ''} foi enviado e está a caminho. 🚚 Sua cliente já foi avisada.`,
          tipo: 'pedido',
        })
      }
    }
  } catch (e) {
    console.error('[pedidoEmails] falha ao enviar e-mails/notificações de status:', e)
  }
}
