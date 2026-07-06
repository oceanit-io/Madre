import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { diagnosticoCorreios, calcularFretesCorreios, CAIXA_PADRAO, PESO_FIXO_GRAMAS } from '@/lib/correios'

export const dynamic = 'force-dynamic'

// Endpoint admin de diagnóstico Correios.
// GET /api/admin/correios-diag (Authorization: Bearer prata925)
//   ?cep=01310100  → testa também uma cotação real pra esse CEP.
//
// Retorna:
//   - Quais env vars estão presentes/faltantes (sem expor valores)
//   - Resultado da chamada Correios PPN (se cep informado)
//
// Pensado pra debug rápido sem precisar ver logs do Vercel.
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const diag = diagnosticoCorreios()

  // Resumo das envs (presença, sem expor valores).
  const envs = {
    CORREIOS_USUARIO:          !!process.env.CORREIOS_USUARIO,
    CORREIOS_SENHA:            !!process.env.CORREIOS_SENHA,
    CORREIOS_CONTRATO:         !!process.env.CORREIOS_CONTRATO,
    CORREIOS_CARTAO_POSTAGEM:  !!process.env.CORREIOS_CARTAO_POSTAGEM,
    CORREIOS_DR:               !!process.env.CORREIOS_DR,
    CORREIOS_CEP_ORIGEM:       !!process.env.CORREIOS_CEP_ORIGEM,
    CORREIOS_PAC_CODIGO:       !!process.env.CORREIOS_PAC_CODIGO,
    CORREIOS_SEDEX_CODIGO:     !!process.env.CORREIOS_SEDEX_CODIGO,
  }

  // Comprimento do CEP origem (sem expor valor) — útil pra detectar typo
  // (ex: pegou 7 dígitos por engano).
  const cepOrigemLen = (process.env.CORREIOS_CEP_ORIGEM || '').replace(/\D/g, '').length

  if (diag.ok === false) {
    return NextResponse.json({
      ok: false,
      motivo: 'Configuração incompleta — corrige as env vars apontadas e refaz o deploy.',
      faltantes: diag.faltantes,
      envs_presentes: envs,
      cep_origem_digitos: cepOrigemLen,
      params_default: { peso_g: PESO_FIXO_GRAMAS, caixa: CAIXA_PADRAO },
    })
  }

  // Teste opcional contra um CEP destino.
  const cepDestino = (new URL(request.url).searchParams.get('cep') || '').replace(/\D/g, '')
  let teste: unknown = null
  if (cepDestino.length === 8) {
    try {
      teste = await calcularFretesCorreios({
        cepDestino,
        pesoG: PESO_FIXO_GRAMAS,
        ...CAIXA_PADRAO,
      })
    } catch (e) {
      teste = { erro: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({
    ok: true,
    envs_presentes: envs,
    cep_origem_digitos: cepOrigemLen,
    params_default: { peso_g: PESO_FIXO_GRAMAS, caixa: CAIXA_PADRAO },
    teste_cep: cepDestino || null,
    teste_resultado: teste,
    dica: !cepDestino
      ? 'Adiciona ?cep=01310100 (ou qualquer CEP) na URL pra testar uma cotação real.'
      : null,
  })
}
