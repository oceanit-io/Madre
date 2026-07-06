'use client'
import { useEffect, useState } from 'react'

// Calculadora de frete por CEP (padrão ecommerce BR — Mercado Livre,
// Shopee etc.). Reutilizada na página do produto e do carrinho.
//
// Fluxo:
//   1. Usuário digita CEP (máscara 00000-000).
//   2. Ao completar 8 dígitos OU clicar "Calcular" → resolve UF via
//      /api/cep/[cep] e chama /api/frete com {uf, cep, subtotal, qntItens}.
//   3. Mostra opções (PAC/SEDEX) com prazo e valor. Se houver frete grátis
//      (subtotal ≥ R$250 no carrinho), mostra grátis nas duas opções.

type ServicoFrete = 'PAC' | 'SEDEX' | 'PADRAO'

type OpcaoFrete = {
  servico: ServicoFrete
  valor: number
  gratis: boolean
  prazo_dias_min: number
  prazo_dias_max: number
  origem?: 'correios' | 'tabela'
}

type FreteResp = {
  regiao: string
  opcoes: OpcaoFrete[]
}

const NOMES: Record<ServicoFrete, string> = {
  PAC: 'PAC',
  SEDEX: 'SEDEX',
  PADRAO: 'Correios',
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`
  return d
}

type Props = {
  subtotal: number     // pra avaliar frete grátis (≥ R$250)
  qntItens: number     // pra mandar ao backend (compat — não afeta peso)
  cor?: string         // cor de destaque (tema da loja); default preto
  cepInicial?: string  // pré-preenche o input (8 dígitos ou com máscara)
  titulo?: string      // override do título "Calcular frete"
}

export default function CalculadoraFrete({
  subtotal,
  qntItens,
  cor = '#1A1A1A',
  cepInicial = '',
  titulo = 'Calcular frete e prazo',
}: Props) {
  const [cep, setCep] = useState(maskCEP(cepInicial))
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [opcoes, setOpcoes] = useState<OpcaoFrete[] | null>(null)

  const cepDigits = cep.replace(/\D/g, '')
  const cepValido = cepDigits.length === 8

  async function calcular() {
    if (!cepValido || loading) return
    setLoading(true)
    setErro(null)
    setOpcoes(null)
    try {
      // 1) Resolver UF via ViaCEP (já temos /api/cep/[cep]).
      const r1 = await fetch(`/api/cep/${cepDigits}`)
      if (!r1.ok) {
        setErro('CEP não encontrado. Verifique o número.')
        setLoading(false)
        return
      }
      const cepData = (await r1.json()) as { uf?: string; localidade?: string }
      const uf = (cepData.uf || '').toUpperCase().slice(0, 2)
      if (uf.length !== 2) {
        setErro('CEP inválido.')
        setLoading(false)
        return
      }
      // 2) Calcular opções de frete.
      const r2 = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uf, cep: cepDigits, subtotal, qntItens }),
      })
      if (!r2.ok) {
        setErro('Não foi possível calcular o frete agora.')
        setLoading(false)
        return
      }
      const data = (await r2.json()) as FreteResp
      setOpcoes(data.opcoes || [])
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-calcula ao chegar a 8 dígitos (snappy, sem precisar clicar).
  useEffect(() => {
    if (cepValido) {
      void calcular()
    } else {
      setOpcoes(null)
      setErro(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigits, subtotal, qntItens])

  return (
    <div className="cf-box" style={{
      background: '#FAFAFA',
      border: '1px solid #EEE',
      borderRadius: 14,
      padding: 16,
    }}>
      {/* Em telas estreitas (<360px), input + botão empilham verticalmente
          pra não cortar o "Calcular". Acima, ficam lado-a-lado. */}
      <style>{`
        .cf-titulo { font-size:12px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#666; margin-bottom:12px; }
        .cf-row { display:flex; gap:8px; align-items:stretch; flex-wrap:wrap; }
        .cf-input { flex:1 1 160px; min-width:0; padding:11px 14px; border:1px solid #E5E5E5; border-radius:10px; font-size:14px; background:#fff; outline:none; font-family:inherit; box-sizing:border-box; letter-spacing:1.5px; }
        .cf-btn { padding:0 18px; min-height:42px; border-radius:10px; border:none; color:#fff; font-weight:700; font-size:13px; font-family:inherit; white-space:nowrap; transition:background .2s; flex:0 0 auto; }
        @media (max-width:360px) { .cf-row { flex-direction:column; } .cf-btn { width:100%; min-height:44px; } }
        .cf-opcao { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:#fff; border:1px solid #EEE; }
        .cf-opcao-info { min-width:0; flex:1 1 auto; }
        .cf-opcao-nome { font-size:13.5px; font-weight:700; color:#1A1A1A; }
        .cf-opcao-prazo { font-size:11.5px; color:#888; margin-top:1px; line-height:1.35; }
        .cf-opcao-preco { font-size:14px; font-weight:700; white-space:nowrap; flex-shrink:0; }
      `}</style>
      <div className="cf-titulo">🚚 {titulo}</div>
      <div className="cf-row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="00000-000"
          value={cep}
          onChange={e => setCep(maskCEP(e.target.value))}
          maxLength={9}
          className="cf-input"
        />
        <button
          type="button"
          onClick={calcular}
          disabled={!cepValido || loading}
          className="cf-btn"
          style={{
            background: !cepValido || loading ? '#CCC' : cor,
            cursor: !cepValido || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '...' : 'Calcular'}
        </button>
      </div>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 8, fontSize: 11.5, color: '#888', textDecoration: 'underline' }}
      >
        Não sei meu CEP
      </a>

      {erro && (
        <div style={{ marginTop: 12, padding: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 12.5, fontWeight: 500 }}>
          {erro}
        </div>
      )}

      {opcoes && opcoes.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opcoes.map(op => (
            <div key={op.servico} className="cf-opcao">
              <div className="cf-opcao-info">
                <div className="cf-opcao-nome">{NOMES[op.servico]}</div>
                <div className="cf-opcao-prazo">
                  Entrega em {op.prazo_dias_min}-{op.prazo_dias_max} dias úteis
                </div>
              </div>
              <div className="cf-opcao-preco" style={{ color: op.gratis ? '#15803D' : cor }}>
                {op.gratis ? 'Grátis' : formatBRL(op.valor)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
