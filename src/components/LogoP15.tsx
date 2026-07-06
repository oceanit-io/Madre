// Logo textual da marca + pill 'Revendedoras' — usado em todas as páginas
// do fluxo da revendedora (landing, auth, perfil).
//
// White-label: o texto vem de `brand` (logoPrefixo + logoDestaque) e a cor
// de `brand.corDestaque`. Mantém o nome do componente (LogoP15) só pra não
// quebrar os imports espalhados.

import { brand } from '@/lib/brand'

type Props = {
  altura?: number          // px — controla o tamanho da logo
  pill?: boolean           // mostra a pill 'Revendedoras' ao lado
  linkHome?: boolean       // envolve em <a href="/"> (header)
  centro?: boolean         // centraliza horizontalmente (formulários)
}

export function LogoP15({ altura = 36, pill = true, linkHome = false, centro = false }: Props) {
  const inner = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      textDecoration: 'none',
    }}>
      <span style={{
        fontFamily: 'Montserrat,sans-serif', fontWeight: 900,
        fontSize: Math.round(altura * 0.52), lineHeight: 1, letterSpacing: -0.5,
        color: '#1A1A1A', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {brand.logoPrefixo}{brand.logoDestaque && (
          <> <span style={{ color: brand.corDestaque }}>{brand.logoDestaque}</span></>
        )}
      </span>
      {pill && (
        <span style={{
          fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 800,
          color: brand.corDestaque, textTransform: 'uppercase', letterSpacing: 1,
          padding: '3px 8px', borderRadius: 999,
          background: '#FDE8EE', border: '1px solid #F4C0D1', whiteSpace: 'nowrap',
        }}>
          Revendedoras
        </span>
      )}
    </span>
  )

  const wrapStyle: React.CSSProperties = centro
    ? { display: 'flex', justifyContent: 'center', alignItems: 'center' }
    : { display: 'inline-flex' }

  if (linkHome) {
    return (
      <div style={wrapStyle}>
        <a href="/" aria-label={`${brand.logoPrefixo} ${brand.logoDestaque} — Revendedoras`} style={{ textDecoration: 'none' }}>
          {inner}
        </a>
      </div>
    )
  }
  return <div style={wrapStyle}>{inner}</div>
}
