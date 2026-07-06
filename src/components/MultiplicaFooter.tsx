'use client'

// Footer global: aparece no rodapé de todas as páginas via root layout.
// Estratégia comercial: divulgar Multiplica + Ocean IT pra capturar
// clientes que vejam a plataforma e queiram um sistema similar.
//
// V2: usa texto estilizado em vez de PNGs (que não existiam ainda).
// Mantém visual sóbrio e clicável. Fundo escuro discreto.

// Ambos os links (Multiplica.fácil e Ocean·it) levam pro site da Ocean IT
// (empresa operadora), não pro WhatsApp pessoal.
const OCEANIT_URL = 'https://oceanit.io'

export default function MultiplicaFooter() {
  return (
    <div
      className="multiplica-footer"
      style={{
        background: '#0A0A0A',
        color: '#999999',
        textAlign: 'center',
        padding: '14px 16px',
        fontSize: 11,
        fontFamily: '-apple-system, "Inter", system-ui, sans-serif',
        letterSpacing: '.3px',
        lineHeight: 1.4,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <span>Quer um sistema como esse?</span>

      <a
        href={OCEANIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Conheça a Ocean IT"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 4,
          textDecoration: 'none',
          color: '#FFFFFF',
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '-.2px',
        }}
      >
        Multiplica<span style={{ fontWeight: 500, opacity: .7, fontSize: 11 }}>.fácil</span>
      </a>

      <span style={{ color: '#555', fontStyle: 'italic' }}>by</span>

      <a
        href={OCEANIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Conheça a Ocean IT"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          textDecoration: 'none',
          color: '#FFFFFF',
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: '-.3px',
        }}
      >
        Ocean<span style={{ color: '#F59E0B', fontWeight: 900 }}>·</span>it
      </a>
    </div>
  )
}
