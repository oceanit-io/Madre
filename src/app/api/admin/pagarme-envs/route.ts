import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// Diagnóstico das envs Pagar.me relacionadas a split, SEM expor valores.
// GET /api/admin/pagarme-envs (Authorization: Bearer prata925)
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const prata15Id = process.env.PAGARME_PRATA15_RECIPIENT_ID || ''
  const mainId = process.env.PAGARME_MAIN_RECIPIENT_ID || ''
  return NextResponse.json({
    PAGARME_SECRET_KEY: !!process.env.PAGARME_SECRET_KEY,
    PAGARME_MAX_PARCELAS: process.env.PAGARME_MAX_PARCELAS || '(não setada — default 1)',
    PAGARME_REVENDEDORA_PERCENT: process.env.PAGARME_REVENDEDORA_PERCENT || '(não setada — default 0.30)',
    PAGARME_PRATA15_PERCENT: process.env.PAGARME_PRATA15_PERCENT || '(não setada — default 0.695)',
    PAGARME_PRATA15_RECIPIENT_ID: prata15Id
      ? `${prata15Id.slice(0, 6)}...${prata15Id.slice(-4)} (setada, ${prata15Id.length} chars)`
      : '(NÃO setada — sem split pra Prata 15)',
    PAGARME_MAIN_RECIPIENT_ID: mainId
      ? `${mainId.slice(0, 6)}...${mainId.slice(-4)} (setada, ${mainId.length} chars)`
      : '(NÃO setada — sem split em hipótese nenhuma; Pagar.me exige uma regra com flags=true)',
    PAGARME_BASE_URL: process.env.PAGARME_BASE_URL || '(default produção)',
  })
}
