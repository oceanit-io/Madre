import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { diagnosticoCorreios } from '@/lib/correios'

export const dynamic = 'force-dynamic'

// Diagnóstico DETALHADO: chama cada passo da Correios separadamente
// (auth → preço PAC → prazo PAC → preço SEDEX → prazo SEDEX) e devolve
// o resultado HTTP de cada um. Permite ver exatamente onde dá pau.
//
// GET /api/admin/correios-diag-v2?cep=01310100
//   (Authorization: Bearer prata925)
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const diag = diagnosticoCorreios()
  if (diag.ok === false) {
    return NextResponse.json({ erro: 'Envs incompletas', faltantes: diag.faltantes }, { status: 400 })
  }
  const cred = diag.cred
  const cepDestino = (new URL(request.url).searchParams.get('cep') || '01310100').replace(/\D/g, '')

  // Tentativa em ambos ambientes (prod + hom) pra descobrir qual auth
  // funciona. Se prod=401 mas hom=200, as credenciais são de teste.
  const AMBIENTES = [
    { nome: 'PRODUCAO',    base: 'https://api.correios.com.br' },
    { nome: 'HOMOLOGACAO', base: 'https://apihom.correios.com.br' },
  ]
  const basic = Buffer.from(`${cred.usuario}:${cred.senha}`).toString('base64')

  async function tentarAuth(base: string) {
    try {
      const resp = await fetch(`${base}/token/v1/autentica/cartaopostagem`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ numero: cred.cartao }),
        cache: 'no-store',
      })
      const corpo = await resp.text().catch(() => '')
      let tok = ''
      if (resp.ok) {
        try { tok = (JSON.parse(corpo || '{}') as { token?: string }).token || '' } catch { /* */ }
      }
      return {
        status_http: resp.status,
        ok: resp.ok,
        body_preview: corpo.slice(0, 500),
        token: tok,
      }
    } catch (e) {
      return { erro_rede: e instanceof Error ? e.message : String(e), token: '' }
    }
  }

  const authProd = await tentarAuth(AMBIENTES[0].base)
  const authHom  = await tentarAuth(AMBIENTES[1].base)

  const token = authProd.token || authHom.token
  const ambienteOk = authProd.token ? AMBIENTES[0] : (authHom.token ? AMBIENTES[1] : null)

  if (!token || !ambienteOk) {
    return NextResponse.json({
      step_atual: 'auth',
      resultado: 'falhou em ambos ambientes',
      producao:    authProd,
      homologacao: authHom,
      dica: 'Auth falhou em produção E homologação. Se ambos retornam 401, alguma das envs está errada (usuário, senha ou cartão). Se prod=401 mas hom=200, suas credenciais são de homologação — peça ao gestor as de produção.',
    })
  }

  const stepAuth = {
    ambiente_funcionou: ambienteOk.nome,
    base_url: ambienteOk.base,
    producao:    authProd,
    homologacao: authHom,
  }
  const BASE_CORREIOS = ambienteOk.base

  // ---------- Step 2: preço/prazo via GET com query params ----------
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  const qsPreco = new URLSearchParams({
    nuRequisicao: '1',
    nuContrato: cred.contrato,
    nuDR: cred.dr,
    cepOrigem: cred.cepOrigem,
    cepDestino: cepDestino,
    psObjeto: '500',
    comprimento: '16',
    largura: '11',
    altura: '4',
    tpObjeto: '2',
  }).toString()
  const qsPrazo = new URLSearchParams({
    nuRequisicao: '1',
    cepOrigem: cred.cepOrigem,
    cepDestino: cepDestino,
  }).toString()

  async function testarServico(codigo: string, label: string) {
    const out: Record<string, unknown> = { codigo_servico: codigo }
    try {
      const respP = await fetch(`${BASE_CORREIOS}/preco/v1/nacional/${codigo}?${qsPreco}`, {
        method: 'GET', headers, cache: 'no-store',
      })
      const corpoP = await respP.text().catch(() => '')
      out.preco_http = respP.status
      out.preco_body_preview = corpoP.slice(0, 400)

      const respPz = await fetch(`${BASE_CORREIOS}/prazo/v1/nacional/${codigo}?${qsPrazo}`, {
        method: 'GET', headers, cache: 'no-store',
      })
      const corpoPz = await respPz.text().catch(() => '')
      out.prazo_http = respPz.status
      out.prazo_body_preview = corpoPz.slice(0, 400)
    } catch (e) {
      out.erro_rede = e instanceof Error ? e.message : String(e)
    }
    return { [label]: out }
  }

  const [pac, sedex] = await Promise.all([
    testarServico(cred.pacCodigo, 'PAC'),
    testarServico(cred.sedexCodigo, 'SEDEX'),
  ])

  return NextResponse.json({
    step_atual: 'completo',
    cep_origem_ok: cred.cepOrigem.length === 8,
    cep_destino: cepDestino,
    contrato_len: cred.contrato.length,
    cartao_len: cred.cartao.length,
    dr: cred.dr,
    auth: stepAuth,
    ...pac,
    ...sedex,
    dica: 'Veja preco_body_preview e prazo_body_preview pra cada serviço. Se contiver "contrato inválido" ou "serviço não contratado", os códigos PAC/SEDEX estão errados.',
  })
}
