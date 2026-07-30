// Feature flags por cliente — lidas do ambiente do deploy.
//
// Cada cliente é um deploy separado na Vercel com envs próprias, então
// o valor de uma flag é fixo por cliente (não muda em runtime). Isso
// permite ligar módulos opcionais só pra quem contratou (ecommerce
// manual, integração WhatsApp, relatório avançado, etc).
//
// COMO USAR
//
// 1. Esconder na UI (Client ou Server Component):
//
//    import { features } from '@/lib/features'
//
//    export default function Sidebar() {
//      return (
//        <nav>
//          <Link href="/dashboard">Início</Link>
//          {features.ecommerce && <Link href="/produtos-manuais">Produtos</Link>}
//          {features.whatsapp  && <Link href="/whatsapp">WhatsApp</Link>}
//          {features.relatorio && <Link href="/relatorio">Relatório</Link>}
//        </nav>
//      )
//    }
//
// 2. Bloquear no route handler (nunca confiar só na UI — o botão
//    escondido não protege o endpoint):
//
//    // src/app/api/produtos-manuais/route.ts
//    import { features } from '@/lib/features'
//    import { NextResponse } from 'next/server'
//
//    export async function POST(req: Request) {
//      if (!features.ecommerce) {
//        return NextResponse.json({ error: 'feature_indisponivel' }, { status: 404 })
//      }
//      // ... resto do handler
//    }
//
// 3. Documentar cada flag no .env.example. Já feito na seção 14.
//
// DEFAULT
//
// Todas as flags são OPT-IN: default = false. Um cliente que não
// setar a env não recebe a feature. Isso vale mesmo em dev — se
// quiser testar localmente, seta `FEATURE_X=true` no .env.local.

function readBool(envKey: string): boolean {
  const raw = process.env[envKey]
  if (!raw) return false
  return raw.trim().toLowerCase() === 'true'
}

export const features = {
  /**
   * CRUD manual de produtos (para clientes que não usam Tray).
   * Endpoints: /api/produtos-manuais, /admin/produtos.
   * Env: FEATURE_ECOMMERCE
   */
  ecommerce: readBool('FEATURE_ECOMMERCE'),

  /**
   * Integração com WhatsApp (mensagens automáticas).
   * Endpoint: /api/whatsapp.
   * Env: FEATURE_WHATSAPP
   */
  whatsapp: readBool('FEATURE_WHATSAPP'),

  /**
   * Módulo de relatório avançado (dashboards extras no admin).
   * Rotas: /admin/relatorio/*.
   * Env: FEATURE_RELATORIO
   */
  relatorio: readBool('FEATURE_RELATORIO'),
} as const

export type FeatureKey = keyof typeof features
