import { NextResponse } from 'next/server'
import { calcularFretes, valorConfiavelDoServico, type ServicoFrete } from '@/lib/frete'
import { enviarEmail } from '@/lib/email'
import { pedidoCriadoClienteEmail, novaVendaRevendedoraEmail } from '@/lib/emailTemplates'
import { criarLinkPagBank } from '@/lib/pagbank'
import { criarLinkPagarme, pagarmeHabilitado, REVENDEDORA_VIA_SPLIT } from '@/lib/pagarme'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type ItemEntrada = {
  id: string
  quantidade: number
  foto?: string
  // Variação Tray (opcional): a revendedora usa variação+ref pra montar o pedido.
  variantId?: string
  variacao?: string
  ref?: string
}

type PedidoBody = {
  cliente?: {
    nome?: string
    email?: string
    cpf?: string
    telefone?: string
  }
  endereco?: {
    cep?: string
    rua?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    uf?: string
  }
  itens?: ItemEntrada[]
  frete_servico?: 'PAC' | 'SEDEX' | 'PADRAO' | null
  slugRevendedora?: string
  observacoes?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarCPF(cpfRaw: string): boolean {
  const cpf = (cpfRaw || '').replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf[9], 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf[10], 10)) return false

  return true
}

function gerarNumeroPedido(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `PED-${y}${m}${d}-${rand}`
}

export async function POST(request: Request) {
  let body: PedidoBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const cliente = body.cliente || {}
  const endereco = body.endereco || {}
  const itensEntrada = Array.isArray(body.itens) ? body.itens : []

  // ---------- Validación de datos del cliente ----------
  const nome = (cliente.nome || '').trim()
  const email = (cliente.email || '').trim().toLowerCase()
  const cpf = (cliente.cpf || '').replace(/\D/g, '')
  const telefone = (cliente.telefone || '').replace(/\D/g, '')

  if (nome.length < 3) {
    return NextResponse.json({ erro: 'Nome inválido' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ erro: 'E-mail inválido' }, { status: 400 })
  }
  if (!validarCPF(cpf)) {
    return NextResponse.json({ erro: 'CPF inválido' }, { status: 400 })
  }
  if (telefone.length < 10 || telefone.length > 11) {
    return NextResponse.json({ erro: 'Telefone inválido' }, { status: 400 })
  }

  // ---------- Validación de dirección ----------
  const cep = (endereco.cep || '').replace(/\D/g, '')
  const rua = (endereco.rua || '').trim()
  const numero = (endereco.numero || '').trim()
  const complemento = (endereco.complemento || '').trim()
  const bairro = (endereco.bairro || '').trim()
  const cidade = (endereco.cidade || '').trim()
  const uf = (endereco.uf || '').trim().toUpperCase()

  if (cep.length !== 8) {
    return NextResponse.json({ erro: 'CEP inválido' }, { status: 400 })
  }
  if (!rua || !numero || !bairro || !cidade) {
    return NextResponse.json({ erro: 'Endereço incompleto' }, { status: 400 })
  }
  if (uf.length !== 2) {
    return NextResponse.json({ erro: 'UF inválida' }, { status: 400 })
  }

  if (itensEntrada.length === 0) {
    return NextResponse.json({ erro: 'Carrinho vazio' }, { status: 400 })
  }

  // ---------- Recalcular precios desde la BD (NO confiar en el cliente) ----------
  const supabase = supabaseAdmin()

  const ids = Array.from(new Set(itensEntrada.map(i => String(i.id))))
  const { data: produtos, error: prodErro } = await supabase
    .from('produtos')
    .select('id, sku, nome, preco, preco_promo, fotos, ativo, estoque, variacoes_cache')
    .in('id', ids)

  if (prodErro) {
    return NextResponse.json(
      { erro: 'Erro ao validar produtos' },
      { status: 500 }
    )
  }

  const mapaProdutos = new Map((produtos || []).map(p => [p.id, p]))

  const itensFinais: {
    id: string
    sku: string
    nome: string
    preco: number
    foto: string
    quantidade: number
    variantId?: string
    variacao?: string
    ref?: string
  }[] = []
  let subtotal = 0

  for (const entrada of itensEntrada) {
    const p = mapaProdutos.get(String(entrada.id))
    if (!p || !p.ativo) {
      return NextResponse.json(
        { erro: 'Algum produto do carrinho não está mais disponível' },
        { status: 409 }
      )
    }

    const quantidade = Math.max(1, Math.floor(Number(entrada.quantidade) || 1))

    // Anti-overselling: rejeita se o estoque (quando conhecido) não cobre a
    // quantidade. estoque null = desconhecido (não bloqueia, pra não barrar
    // item ainda não sincronizado). A vitrine já filtra estoque>0, mas a
    // fonte de verdade do pedido precisa revalidar (2 clientes, última peça).
    const estoqueProd = (p as { estoque?: number | null }).estoque
    if (estoqueProd != null && Number(estoqueProd) < quantidade) {
      return NextResponse.json(
        { erro: `"${p.nome}" está sem estoque suficiente. Ajuste a quantidade.` },
        { status: 409 }
      )
    }
    // Preço: se a variação escolhida tem preço próprio (na Tray, tamanhos
    // maiores custam mais), cobra o preço DA VARIAÇÃO — lido do cache no DB,
    // nunca do cliente. Sem variação (ou sem preço), usa o preço cheio do
    // produto. `preco_promo` é da Tray e não vale aqui.
    let precoUnit = Number(p.preco)
    if (entrada.variantId && Array.isArray(p.variacoes_cache)) {
      const v = (p.variacoes_cache as Array<{ variant_id?: string; preco?: number }>)
        .find(x => String(x.variant_id) === String(entrada.variantId))
      if (v && Number(v.preco) > 0) precoUnit = Number(v.preco)
    }
    const fotoBd = Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos[0] : ''

    subtotal += precoUnit * quantidade
    itensFinais.push({
      id: p.id,
      sku: p.sku,
      nome: p.nome,
      preco: precoUnit,
      foto: entrada.foto || fotoBd,
      quantidade,
      // Variação é descritiva (tamanho/ref) — não afeta o preço, que é sempre
      // o `preco` cheio do produto. Vem do client só pra fulfillment.
      ...(entrada.variantId ? { variantId: String(entrada.variantId) } : {}),
      ...(entrada.variacao ? { variacao: String(entrada.variacao).slice(0, 120) } : {}),
      ...(entrada.ref ? { ref: String(entrada.ref).slice(0, 60) } : {}),
    })
  }

  subtotal = Math.round(subtotal * 100) / 100

  // ---------- Frete (recalculado en el server, anti-tamper) ----------
  // Server consulta Correios PPN com os mesmos params (uf, cep, subtotal,
  // qntItens) e usa o valor da opção escolhida pelo cliente. Se a opção
  // não existir, cai pra primeira opção válida.
  const qntItens = itensFinais.reduce((a, i) => a + i.quantidade, 0)
  const servicoEntrada = body.frete_servico as ServicoFrete | null | undefined
  let frete = servicoEntrada
    ? await valorConfiavelDoServico(uf, cep, subtotal, qntItens, servicoEntrada)
    : null
  if (!frete) {
    const r = await calcularFretes(uf, cep, subtotal, qntItens)
    frete = r.opcoes[0] ?? null
  }
  if (!frete) {
    return NextResponse.json({ erro: 'Não foi possível calcular o frete' }, { status: 500 })
  }
  const total = Math.round((subtotal + frete.valor) * 100) / 100

  const slugRevendedora = (body.slugRevendedora || '').trim() || null
  // Todo pedido nasce de uma loja (/loja/[slug]). Sem slug, a venda não tem a
  // quem ser atribuída — não credita comissão e fica órfã. Barra na origem.
  if (!slugRevendedora) {
    return NextResponse.json(
      { erro: 'Pedido sem loja de origem. Recarregue a loja e tente novamente.' },
      { status: 400 }
    )
  }

  // Cadastro bancário OBRIGATÓRIO pra vender: a loja só recebe pedidos quando
  // a revendedora já cadastrou o recebedor Pagar.me (pra entrar no split). Sem
  // recebedor, barra a venda com mensagem clara. (Recebedor 'pending' já passa
  // — está em aprovação; cai no modelo interno até virar 'active'.)
  {
    const { data: revKyc } = await supabase
      .from('revendedoras')
      .select('pagarme_recipient_id')
      .eq('subdominio', slugRevendedora)
      .maybeSingle()
    if (!revKyc?.pagarme_recipient_id) {
      return NextResponse.json(
        { erro: 'Esta loja está finalizando o cadastro e ainda não pode receber pedidos. Volte em breve! 💎' },
        { status: 409 }
      )
    }
  }

  const observacoes = (body.observacoes || '').trim() || null

  // ---------- Insert con numero_pedido único (retry en colisión) ----------
  let ultimoErro: unknown = null
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const numero_pedido = gerarNumeroPedido()
    const { data, error } = await supabase
      .from('pedidos')
      .insert({
        numero_pedido,
        status: 'aguardando_pagamento',
        cliente_nome: nome,
        cliente_email: email,
        cliente_cpf: cpf,
        cliente_telefone: telefone,
        endereco_cep: cep,
        endereco_rua: rua,
        endereco_numero: numero,
        endereco_complemento: complemento || null,
        endereco_bairro: bairro,
        endereco_cidade: cidade,
        endereco_uf: uf,
        itens: itensFinais,
        subtotal,
        frete: frete.valor,
        total,
        regiao_frete: frete.regiao,
        frete_servico: servicoEntrada || null,
        slug_revendedora: slugRevendedora,
        pagbank_link: null,
        pagbank_pago: false,
        observacoes,
      })
      .select('id, numero_pedido')
      .single()

    if (!error && data) {
      // E-mail de confirmação ao cliente (best-effort: nunca quebra o pedido).
      try {
        let waLink: string | null = null
        let revNome: string | null = null
        let revId: string | null = null
        let revEmail: string | null = null
        let revRecipientId: string | null = null
        let revRecipientStatus: string | null = null
        if (slugRevendedora) {
          const { data: rev } = await supabase
            .from('revendedoras')
            .select('id, nome, whatsapp, email, pagarme_recipient_id, pagarme_recipient_status')
            .eq('subdominio', slugRevendedora)
            .single()
          if (rev) {
            revId = rev.id
            revNome = rev.nome || null
            revEmail = rev.email || null
            revRecipientId = (rev.pagarme_recipient_id as string) || null
            revRecipientStatus = (rev.pagarme_recipient_status as string) || null
            const w = (rev.whatsapp || '').replace(/\D/g, '')
            if (w) {
              const msg = encodeURIComponent(
                `Olá! Fiz o pedido ${data.numero_pedido} na loja (total ${total.toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' }
                )}). Gostaria de combinar o pagamento.`
              )
              waLink = `https://wa.me/55${w}?text=${msg}`
            }
          }
        }

        // Link de pagamento online: Pagar.me se ativo, senão PagBank (ambos
        // gated: no-op sem a env). Guardado em pagbank_link (campo genérico
        // de "link de pagamento online"). Best-effort — nunca quebra o pedido.
        let pagbankLink: string | null = null
        try {
          const appUrl =
            process.env.APP_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'https://lojadeprata925.com.br'
          // SPLIT 3-way:
          //   30%               → revendedora (recipient próprio dela,
          //                       SÓ quando o KYC dela estiver ATIVO)
          //   69.5% + frete     → Prata 15 (supplier — recebe a parte
          //                       do produto + a postagem inteira pra
          //                       cobrir o envio)
          //   0.5% subtotal     → Gabriela = CONTA MÃE Pagar.me, recebe
          //                       como REMAINDER automático
          //
          // As 2 regras são INDEPENDENTES. A Gabriela sempre fica com
          // o que sobrar (não precisa de regra), o que torna o split
          // dela 0.5% se as duas regras explícitas estão ativas, ou
          // mais se alguma estiver desligada.
          //
          // Cenários:
          //   rev ativa + Prata15 setada  → 30% rev + (69.5%+frete) Prata15 + 0.5% Gabriela
          //   rev ativa + sem Prata15     → 30% rev + 70% subtotal + frete pra Gabriela
          //   rev inativa + Prata15 setada → (69.5%+frete) Prata15 + 30.5% subtotal pra Gabriela
          //   nenhuma                     → 100% pra Gabriela
          const REV_PERCENT = Number(process.env.PAGARME_REVENDEDORA_PERCENT) || 0.30
          const PRATA15_PERCENT = Number(process.env.PAGARME_PRATA15_PERCENT) || 0.695
          const prata15RecipientId = process.env.PAGARME_PRATA15_RECIPIENT_ID || ''
          const mainAccountRecipientId = process.env.PAGARME_MAIN_RECIPIENT_ID || ''
          const revAtiva = REVENDEDORA_VIA_SPLIT && !!(revRecipientId && revRecipientStatus === 'active')

          const subtotalCent = Math.round(subtotal * 100)
          const freteCent = Math.round((Number(frete.valor) || 0) * 100)
          const totalCent = subtotalCent + freteCent
          const comissaoCent = revAtiva ? Math.round(subtotalCent * REV_PERCENT) : 0
          // Prata 15 recebe % do subtotal + frete inteiro (cobre postagem).
          const prata15Cent = prata15RecipientId
            ? Math.round(subtotalCent * PRATA15_PERCENT) + freteCent
            : 0
          // Conta mãe recebe o resto. SEMPRE precisa ter UMA regra com
          // flags responsabilidade=true em paymentlinks Pagar.me. Sem
          // ela setada, NÃO faz split (vai 100% pra conta principal
          // via default Pagar.me).
          const mainAccountCent = mainAccountRecipientId
            ? totalCent - comissaoCent - prata15Cent
            : 0

          const splitConfig: Record<string, unknown> = {}
          if (mainAccountRecipientId && mainAccountCent > 0) {
            if (revAtiva && revRecipientId && comissaoCent > 0) {
              splitConfig.revendedoraRecipientId = revRecipientId
              splitConfig.comissaoCentavos = comissaoCent
            }
            if (prata15RecipientId && prata15Cent > 0) {
              splitConfig.prata15RecipientId = prata15RecipientId
              splitConfig.prata15Centavos = prata15Cent
            }
            splitConfig.mainAccountRecipientId = mainAccountRecipientId
            splitConfig.mainAccountCentavos = mainAccountCent
          }
          const dadosCobranca = {
            numeroPedido: data.numero_pedido,
            total,
            cliente: { nome, email, telefone, cpf },
            // Pagar.me devolve o comprador pra cá após pagar.
            successUrl: `${appUrl.replace(/\/$/, '')}/pedido/${data.id}/aguardando-pagamento`,
            ...(Object.keys(splitConfig).length > 0 ? { split: splitConfig } : {}),
          }
          const pg = pagarmeHabilitado()
            ? await criarLinkPagarme(dadosCobranca)
            : await criarLinkPagBank(dadosCobranca)
          if (pg) {
            pagbankLink = pg.link
            await supabase
              .from('pedidos')
              .update({ pagbank_link: pg.link })
              .eq('id', data.id)
          }
        } catch (e) {
          console.error('Falha ao criar link de pagamento:', e)
        }

        const { subject, html } = pedidoCriadoClienteEmail({
          numeroPedido: data.numero_pedido,
          nome,
          itens: itensFinais.map(i => ({
            nome: i.nome,
            sku: i.sku,
            preco: i.preco,
            quantidade: i.quantidade,
            variacao: i.variacao,
            ref: i.ref,
          })),
          subtotal,
          frete: frete.valor,
          total,
          endereco: { rua, numero, complemento, bairro, cidade, uf, cep },
          revNome,
          waLink,
          pagbankLink,
        })

        await enviarEmail({ to: email, subject, html })

        // 🎉 Notificação motivacional pra revendedora (best-effort).
        if (revId) {
          const primeiro = (revNome || '').split(' ')[0] || 'revendedora'
          const totalFmt = total.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
          await supabase.from('notificacoes').insert({
            revendedora_id: revId,
            titulo: '🎉 Eba! Caiu um pedido novo!',
            mensagem: `Parabéns, ${primeiro}! 💎 O pedido ${data.numero_pedido} (${totalFmt}) acabou de chegar na sua loja. Bora confirmar o pagamento e faturar! 🚀✨`,
            tipo: 'venda',
          })

          // E-mail de "nova venda" pra revendedora (best-effort).
          if (revEmail) {
            const ev = novaVendaRevendedoraEmail({
              numeroPedido: data.numero_pedido,
              revNome: revNome || '',
              clienteNome: nome,
              total,
            })
            await enviarEmail({ to: revEmail, subject: ev.subject, html: ev.html })
          }
        }
      } catch (e) {
        console.error('Falha ao enviar e-mail/notificação do pedido:', e)
      }

      return NextResponse.json({
        id: data.id,
        numero_pedido: data.numero_pedido,
      })
    }

    ultimoErro = error
    // 23505 = unique_violation (numero_pedido repetido) → reintenta
    if ((error as { code?: string } | null)?.code !== '23505') break
  }

  console.error('Erro ao criar pedido:', ultimoErro)
  return NextResponse.json(
    { erro: 'Não foi possível criar o pedido. Tente novamente.' },
    { status: 500 }
  )
}
