import Image from 'next/image'

type Logo925Props = {
  variant?: 'full' | 'transparent' | 'branco' | 'favicon'
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export default function Logo925({
  variant = 'full',
  width = 200,
  height = 200,
  className = '',
  priority = false,
}: Logo925Props) {
  const sources = {
    full: '/branding/logo-925-selo.svg',
    transparent: '/branding/logo-925-selo-transparente.svg',
    branco: '/branding/logo-925-selo-branco.svg',
    favicon: '/branding/favicon-925.svg',
  }

  return (
    <Image
      src={sources[variant]}
      alt="Loja de Prata 925 - Prata Legítima"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  )
}