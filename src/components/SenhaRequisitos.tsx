// Checklist de requisitos de senha em tempo real. Cada regra fica
// VERMELHA enquanto não atende, VERDE quando atende. Usuária vê o
// que falta sem precisar errar e ler mensagem de erro depois.
//
// Usado em /auth/register e /auth/redefinir-senha (qualquer fluxo
// onde a usuária CRIA uma senha nova).

type Regra = {
  label: string
  testa: (s: string) => boolean
}

const REGRAS: Regra[] = [
  { label: 'Pelo menos 6 caracteres', testa: s => s.length >= 6 },
]

export function senhaAtendeRegras(senha: string): boolean {
  return REGRAS.every(r => r.testa(senha || ''))
}

export default function SenhaRequisitos({ senha }: { senha: string }) {
  // Antes de digitar nada, mostra todas em cinza (estado inicial).
  // Quando começa a digitar, cada uma fica verde ou vermelha.
  const vazia = !senha
  return (
    <div
      style={{
        marginTop: 8,
        padding: '10px 12px',
        background: '#FAFAFA',
        border: '1px solid #EEE',
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      {REGRAS.map((r, i) => {
        const ok = r.testa(senha || '')
        const cor = vazia ? '#999' : ok ? '#15803D' : '#B91C1C'
        const icone = vazia ? '○' : ok ? '✓' : '○'
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: cor,
              fontWeight: ok && !vazia ? 600 : 400,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ width: 14, textAlign: 'center', fontWeight: 700 }}>{icone}</span>
            <span>{r.label}</span>
          </div>
        )
      })}
    </div>
  )
}
