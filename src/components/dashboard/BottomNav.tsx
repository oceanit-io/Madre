'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Tab = {
  key: string
  label: string
  icon: React.ReactNode
  href: string
  external?: boolean // se true, abre em nova aba (não troca a navegação)
}

const tabs: Tab[] = [
  { key: 'dashboard', label: 'Início', icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ), href: '/dashboard' },
  { key: 'vendas', label: 'Vendas', icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ), href: '/vendas' },
  { key: 'loja', label: 'Minha loja', icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  ), href: '/configurar-loja' }, // Personalização da loja (vitrine pública abre por botão lá dentro).
  { key: 'saldo', label: 'Saldo', icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ), href: '/saldo' },
  { key: 'perfil', label: 'Perfil', icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ), href: '/perfil' },
]

export default function BottomNav({ ativa }: { ativa: string }) {
  const router = useRouter()
  // Subdomínio da própria revendedora (cacheado em sessionStorage p/ não
  // re-fetch a cada click; carrega na 1ª renderização). Permite abrir
  // a loja em nova aba diretamente (sem passar por /minha-loja que faz redirect).
  const [subdominio, setSubdominio] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const cached = sessionStorage.getItem('rev-subdominio')
    if (cached) { setSubdominio(cached); return }
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('subdominio')
        .eq('user_id', user.id)
        .single()
      if (rev?.subdominio) {
        sessionStorage.setItem('rev-subdominio', rev.subdominio)
        setSubdominio(rev.subdominio)
      }
    })()
  }, [])

  function clickTab(tab: Tab) {
    if (tab.external) {
      // "Minha loja" abre a página pública dela em nova aba, sem
      // tirar a revendedora do dashboard atual.
      const url = subdominio ? `/loja/${subdominio}` : tab.href
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(tab.href)
  }

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      margin: '0 auto',
      width: '100%',
      maxWidth: 780,
      background: 'white',
      borderTop: '1px solid var(--rosa-border)',
      // padding-bottom = max(16px, safe-area) pra respeitar o notch/home
      // indicator dos iPhones modernos. Sem isso, o nav fica "engolido"
      // pela barra do iOS embaixo.
      padding: '10px 0 max(16px, env(safe-area-inset-bottom))',
      display: 'flex',
      justifyContent: 'space-around',
      zIndex: 1000,
      // Força layer próprio na GPU — evita o "sumir ao scrollar" do
      // iOS Safari (rendering bug com position:fixed).
      WebkitTransform: 'translateZ(0)',
      transform: 'translateZ(0)',
      willChange: 'transform',
      // Sombra sutil pra separar visualmente do conteúdo (estilo Shopee/iFood).
      boxShadow: '0 -2px 12px rgba(0,0,0,.04)',
    }}>
      {tabs.map(tab => {
        const isAtiva = ativa === tab.key
        return (
          <div
            key={tab.key}
            onClick={() => clickTab(tab)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', flex: 1, padding: '4px 0' }}
          >
            <div style={{ width: 22, height: 22 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={isAtiva ? 'var(--rosa)' : 'var(--cinza)'} strokeWidth="2" strokeLinecap="round" width="22" height="22">
                {tab.icon}
              </svg>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: .3, color: isAtiva ? 'var(--rosa)' : 'var(--cinza)' }}>
              {tab.label}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
