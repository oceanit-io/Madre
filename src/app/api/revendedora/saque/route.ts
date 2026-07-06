// POST /api/revendedora/saque — solicita saque PIX. Autenticado via
// Authorization: Bearer <access_token Supabase>.
//
// Fluxo:
//   1. Valida sessão da revendedora.
//   2. Valida valor (> 0, ≤ saldo_disponivel).
//   3. Insere row em `saques` (status='solicitado').
//   4. Debita o valor do `revendedoras.saldo_disponivel` (atômico via RPC
//      `debitar_saldo` se existir; senão update direto guardado por race
//      check de saldo no mesmo .update()).
//   5. Best-effort: insere notificação interna + manda email pra admin
//      Gabriela pra processar o PIX manualmente via Pagar.me / banco.
//
// NÃO chama gateway de transferência automática — Gabriela executa o
// pagamento do lado dela quando confirma a solicitação no painel admin.
// Idempotência: se a mesma revendedora abre 2 saques simultâneos com
// saldo insuficiente, o segundo falha no debit (saldo já foi).

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'
import { enviarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  const { rev, admin } = sessao

  // Só conta ATIVA pode sacar. Suspensa/pendente não retira saldo.
  if (rev.status !== 'ativa') {
    return NextResponse.json({ erro: 'Sua conta não está ativa para saque.' }, { status: 403 })
  }

  let body: { valor?: number; chavePix?: string } = {}
  try { body = await request.json() } catch { /* empty */ }

  const valor = Number(body.valor || 0)
  const chavePix = (body.chavePix || '').trim()

  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: 'Valor inválido.' }, { status: 400 })
  }
  if (valor > rev.saldo_disponivel + 0.001) {
    return NextResponse.json({ erro: 'Valor maior que o saldo disponível.' }, { status: 400 })
  }
  if (!chavePix) {
    return NextResponse.json({ erro: 'Informe sua chave Pix.' }, { status: 400 })
  }

  // 1) Insere saque solicitado.
  const { data: saque, error: insErr } = await admin
    .from('saques')
    .insert({
      revendedora_id: rev.id,
      tipo: 'pix',
      valor,
      chave_pix: chavePix,
      status: 'solicitado',
    })
    .select('id')
    .single()

  if (insErr || !saque) {
    return NextResponse.json({ erro: 'Não foi possível registrar o saque.' }, { status: 500 })
  }

  // 2) Debita do saldo. Guarda contra race: só atualiza se saldo atual
  // ainda comporta o valor. Postgres: update com filtro de saldo >= valor.
  // Como o supabase-js não tem expressão raw direto, lemos e validamos.
  const { data: revAtual } = await admin
    .from('revendedoras')
    .select('saldo_disponivel')
    .eq('id', rev.id)
    .single()

  const saldoAtual = Number(revAtual?.saldo_disponivel || 0)
  if (saldoAtual < valor) {
    // race: alguém debitou antes — desfaz o saque.
    await admin.from('saques').delete().eq('id', saque.id)
    return NextResponse.json({ erro: 'Saldo insuficiente.' }, { status: 400 })
  }

  const { data: updRows, error: updErr } = await admin
    .from('revendedoras')
    .update({ saldo_disponivel: saldoAtual - valor })
    .eq('id', rev.id)
    .eq('saldo_disponivel', saldoAtual) // optimistic lock
    .select('id')

  // 0 linhas afetadas = OUTRO saque debitou esse saldo entre o read e o
  // update (race/duplo-clique). O supabase-js NÃO seta updErr nesse caso,
  // então PRECISAMOS checar o length — senão dois saques saem pelo mesmo
  // dinheiro (saldo debitado 1x, 2 PIX pagos). Desfaz o saque e barra.
  if (updErr || !updRows || updRows.length === 0) {
    await admin.from('saques').delete().eq('id', saque.id)
    return NextResponse.json({ erro: 'O saldo mudou agora. Confira e tente de novo.' }, { status: 409 })
  }

  // 3) Notificação interna pra revendedora (aparece no sino do painel).
  await admin.from('notificacoes').insert({
    revendedora_id: rev.id,
    titulo: 'Saque solicitado',
    mensagem: `Recebemos seu pedido de saque de R$ ${valor.toFixed(2).replace('.', ',')}. Processamos em até 1 dia útil.`,
    tipo: 'saque',
  }).then(() => undefined, () => undefined) // best-effort

  // 4) Email pra admin (Gabriela) pra ela processar o PIX manualmente.
  const adminEmail = process.env.ADMIN_EMAIL || 'gabyfernandezweb@gmail.com'
  try {
    await enviarEmail({
      to: adminEmail,
      subject: `💸 Novo saque solicitado — ${rev.nome} — R$ ${valor.toFixed(2).replace('.', ',')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E8396A; margin: 0 0 16px;">Novo saque solicitado</h2>
          <p style="font-size: 14px; color: #444; margin: 0 0 16px;">
            Uma revendedora pediu um saque via PIX. Processe pelo Pagar.me ou pelo seu banco e marque como "pago" no painel admin.
          </p>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding:8px 0; color:#888;">Revendedora</td><td style="padding:8px 0; text-align:right; font-weight:700;">${escapeHtml(rev.nome)}</td></tr>
            <tr><td style="padding:8px 0; color:#888;">Loja</td><td style="padding:8px 0; text-align:right;">${escapeHtml(rev.nome_loja || rev.subdominio)}</td></tr>
            <tr><td style="padding:8px 0; color:#888;">Valor</td><td style="padding:8px 0; text-align:right; font-weight:900; font-size:18px; color:#089C82;">R$ ${valor.toFixed(2).replace('.', ',')}</td></tr>
            <tr><td style="padding:8px 0; color:#888;">Chave PIX</td><td style="padding:8px 0; text-align:right; font-family:monospace;">${escapeHtml(chavePix)}</td></tr>
            <tr><td style="padding:8px 0; color:#888;">ID do saque</td><td style="padding:8px 0; text-align:right; font-family:monospace; font-size:11px;">${saque.id}</td></tr>
          </table>
          <p style="font-size: 12px; color: #888; margin: 20px 0 0;">
            O saldo da revendedora já foi descontado automaticamente. Painel: <a href="https://lojadeprata925.com.br/admin/saques">admin/saques</a>
          </p>
        </div>
      `,
    })
  } catch {
    // não quebra o saque se email falhar
  }

  return NextResponse.json({ ok: true, saqueId: saque.id })
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
