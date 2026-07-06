// Server Component que envelopa TODAS as rotas /admin/*.
//
// Ao chamar headers() force-dynamic em runtime, Next.js marca todas as
// páginas filhas como dynamic. Resultado: Vercel CDN nunca cacheia
// /admin/* — sempre serve o HTML fresco do build atual.
//
// Antes desse layout, /admin/ativar e outras voltavam com
// x-vercel-cache: HIT mesmo com Cache-Control: no-store via middleware,
// porque o middleware seta header DEPOIS do edge decidir cachear.

import { headers } from 'next/headers'
import AdminUserBadge from '@/components/AdminUserBadge'

export const dynamic = 'force-dynamic'

// CSS global aplicado em TODAS as sub-páginas /admin/* — normaliza
// botões "voltar/ghost" que cada página define com seu próprio
// prefixo (fin-, sq-, vn-, sl-, dq-, ap-, rt-, etc). Em vez de
// editar cada CSS, capturamos pelo selector de attribute.
const ADMIN_GLOBAL_CSS = `
  /* Botões ghost/voltar de cada sub-página admin */
  a[class$="-ghost"],
  a[class$="-btn-ghost"],
  button[class$="-ghost"],
  button[class$="-btn-ghost"] {
    display: inline-flex !important;
    align-items: center;
    gap: 4px;
    padding: 8px 14px;
    background: #fff;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: #475569 !important;
    text-decoration: none !important;
    transition: all .15s;
    box-shadow: 0 1px 2px rgba(15,23,42,.03);
    font-style: normal;
  }
  a[class$="-ghost"]:hover,
  a[class$="-btn-ghost"]:hover,
  button[class$="-ghost"]:hover,
  button[class$="-btn-ghost"]:hover {
    border-color: #6366F1 !important;
    color: #6366F1 !important;
    background: #EEF2FF !important;
    box-shadow: 0 2px 6px rgba(99,102,241,.12) !important;
  }
  a[class$="-ghost"]:visited,
  a[class$="-btn-ghost"]:visited {
    color: #475569 !important;
  }

  /* Links "← Voltar ao Admin" com inline style (visitas, pendentes-lista) */
  a[href="/admin"] {
    color: #475569 !important;
    text-decoration: none !important;
  }
  a[href="/admin"]:hover {
    color: #6366F1 !important;
  }
`

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  headers()
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_GLOBAL_CSS }} />
      <AdminUserBadge />
      {children}
    </>
  )
}
