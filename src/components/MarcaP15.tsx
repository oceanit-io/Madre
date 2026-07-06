// Selo "Catálogo fornecido por {fornecedor}" — reforça a marca FORNECEDORA
// (supplier que provê o catálogo) sem confundir com a marca DA PLATAFORMA.
// White-label: nome e logo do fornecedor vêm de `brand`.
//
// Variantes:
//   - inline (default): row pequena pra header/sidebar
//   - badge: pill com fundo rosa pale, ideal pra card
//   - hero: maior, centralizada, pra rodapé de landing

import Image from 'next/image'
import { brand } from '@/lib/brand'

type Props = {
  variante?: 'inline' | 'badge' | 'hero'
  texto?: string
}

export default function MarcaP15({
  variante = 'inline',
  texto,
}: Props) {
  const tamanhos = {
    inline: { h: 28, w: 61, fs: 11 },
    badge: { h: 24, w: 52, fs: 10 },
    hero: { h: 56, w: 122, fs: 13 },
  } as const
  const t = tamanhos[variante]

  const labelDefault =
    variante === 'hero'
      ? 'Catálogo oficial fornecido por'
      : 'Catálogo by'

  if (variante === 'hero') {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: t.fs, color: '#777', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
          {texto || labelDefault}
        </div>
        <Image
          src={brand.fornecedorLogo}
          alt={`${brand.fornecedor} — Fornecedor`}
          width={t.w * 2}
          height={t.h * 2}
          style={{ height: t.h, width: 'auto', objectFit: 'contain' }}
          priority={false}
        />
      </div>
    )
  }

  if (variante === 'badge') {
    return (
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#FDE8EE', border: '1px solid #F4C0D1',
          borderRadius: 999, padding: '4px 10px',
          fontSize: t.fs, color: '#9B2C5A', fontWeight: 700, whiteSpace: 'nowrap',
        }}
        title={`Catálogo fornecido por ${brand.fornecedor}`}
      >
        <Image
          src={brand.fornecedorLogo}
          alt={brand.fornecedor}
          width={t.w * 2}
          height={t.h * 2}
          style={{ height: t.h, width: 'auto', objectFit: 'contain' }}
        />
        <span>{texto || labelDefault}</span>
      </div>
    )
  }

  // inline (default)
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontSize: t.fs, color: '#666',
      }}
    >
      <span>{texto || labelDefault}</span>
      <Image
        src={brand.fornecedorLogo}
        alt={brand.fornecedor}
        width={t.w * 2}
        height={t.h * 2}
        style={{ height: t.h, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
