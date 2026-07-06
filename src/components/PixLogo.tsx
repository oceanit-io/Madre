// Logo oficial do Pix (Banco Central do Brasil) — SVG vetorial em paths,
// renderiza perfeito em qualquer tamanho. Aspect ratio ~2.82:1 (237×84).
//
// Use a prop `size` p/ controlar a altura em px; a largura ajusta sozinha.

export function PixLogo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/branding/pix.svg"
      alt="Pix"
      height={size}
      style={{ display: 'block', height: size, width: 'auto' }}
    />
  )
}
