import type { Metadata, Viewport } from 'next'
import { CarrinhoProvider } from '@/contexts/CarrinhoContext'
import CarrinhoFloatingButton from '@/components/CarrinhoFloatingButton'
import MultiplicaFooter from '@/components/MultiplicaFooter'
import { brand } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: `${brand.nome} · Revendedoras`,
  description: 'Sua loja de prata 925 legítima com +3.000 itens',
  icons: {
    icon: '/branding/favicon-925.svg',
  },
}

// Sem isso, Safari/Chrome mobile renderizam a página com viewport
// padrão de ~980px e a layout aparece cortada (overflow lateral).
// `viewportFit: 'cover'` garante que CSS env(safe-area-inset-*)
// funcione no iPhone com notch/home indicator.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Preconnect pra reduzir latência da 1ª font request. */}
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        {/* Fontes da app (Montserrat, Poppins, Playfair) + 11 novas opções
            comerciais oferecidas no editor da loja (FONTES_LOJA em
            lib/temasLoja). display=swap pra renderizar com fallback enquanto
            carrega. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Poppins:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;1,6..96,400&family=Cinzel:wght@400;600;700&family=Italiana&family=Marcellus&family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;600;700&family=Allura&family=Great+Vibes&family=Dancing+Script:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CarrinhoProvider>
          {children}
          <CarrinhoFloatingButton />
          <MultiplicaFooter />
        </CarrinhoProvider>
      </body>
    </html>
  )
}