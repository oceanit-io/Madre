import { NextResponse, type NextRequest } from 'next/server'
import { getAdminRole } from '@/lib/adminAuth'

// Domínio canônico: tudo que entrar pelo alias de produção do Vercel é
// redirecionado (308) pro domínio próprio, mantendo rota + query. Assim o
// cliente nunca vê `...vercel.app` na barra e os links compartilhados ficam
// no domínio certo. Os deploys de PREVIEW têm host com hash diferente, então
// NÃO batem nesse alias exato e seguem funcionando normalmente.
const ALIAS_VERCEL_PROD = 'revendedoraspratade15reais.vercel.app'
const HOST_CANONICO = 'lojadeprata925.com.br'

// Rotas onde a Vercel/edge NÃO podem cachear o HTML — UX flow do cliente
// (carrinho, checkout, página de aguardando pagamento) precisa sempre
// servir o build mais recente. /admin entra aqui porque dados de pendentes,
// saldos e saques mudam o tempo todo — cachear quebra a operação.
const NO_CACHE_PATHS = ['/carrinho', '/checkout', '/pedido', '/admin', '/dashboard']

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Admin SOMENTE LEITURA (viewer): bloqueia qualquer ESCRITA em /api/admin
  // (POST/PATCH/PUT/DELETE), exceto login/logout. Deny-by-default: protege
  // todos os endpoints admin de uma vez, sem depender de checagem caso-a-caso.
  // Leituras (GET) seguem liberadas — o viewer vê tudo, só não altera nada.
  if (path.startsWith('/api/admin/')) {
    const metodo = request.method.toUpperCase()
    const ehEscrita = !['GET', 'HEAD', 'OPTIONS'].includes(metodo)
    if (ehEscrita && path !== '/api/admin/login' && getAdminRole(request) === 'viewer') {
      return NextResponse.json(
        { erro: 'Acesso somente leitura: esta ação não é permitida para o seu usuário.' },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  const host = request.headers.get('host') || ''
  if (host === ALIAS_VERCEL_PROD) {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    url.host = HOST_CANONICO
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  if (NO_CACHE_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    const res = NextResponse.next()
    // Cache-Control padrão pro browser/proxies. Vercel CDN ignora isso
    // em rotas que ela considera estáticas → precisamos do CDN-Cache-Control
    // específico, que ela respeita pra decidir se cacheia no edge dela.
    res.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
    res.headers.set('CDN-Cache-Control', 'no-store')
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store')
    return res
  }

  return NextResponse.next()
}

export const config = {
  // Páginas (tudo MENOS /api e assets) pro redirect canônico + no-cache,
  // E TAMBÉM /api/admin pro controle de escrita do viewer (somente leitura).
  // Outros /api (webhooks/checkout) seguem fora do middleware.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/api/admin/:path*',
  ],
}
