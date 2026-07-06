'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  saldoDisponivel: number
  revendedoraId: string
  onClose: () => void
  onSucesso: () => void
}

type Etapa = 'form' | 'sucesso_pix' | 'credito_loja'

// Número WhatsApp Loja de Prata 925 (admin Gabriela)
const WHATS_ADMIN = '5511975427321'

export default function ModalSaque({ saldoDisponivel, revendedoraId, onClose, onSucesso }: Props) {
  const [tipo, setTipo] = useState<'pix' | 'credito_loja'>('pix')
  const [valor, setValor] = useState(saldoDisponivel.toFixed(2))
  const [chavePix, setChavePix] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('form')

  async function handleSaque(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    // Crédito loja: não criamos saque automático. Mandamos pro WhatsApp.
    if (tipo === 'credito_loja') {
      setEtapa('credito_loja')
      return
    }

    const valorNum = parseFloat(valor)
    if (valorNum <= 0 || valorNum > saldoDisponivel) {
      setErro('Valor inválido ou maior que o saldo disponível.')
      return
    }
    if (!chavePix.trim()) {
      setErro('Informe sua chave Pix para sacar.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setErro('Sessão expirada. Faça login novamente.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/revendedora/saque', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ valor: valorNum, chavePix: chavePix.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(data?.erro || 'Não foi possível solicitar o saque agora. Tente novamente.')
        setLoading(false)
        return
      }
      setEtapa('sucesso_pix')
    } catch {
      setErro('Erro de rede. Tente novamente.')
    }
    setLoading(false)
  }

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const valorNum = parseFloat(valor) || 0
  const msgWhats = encodeURIComponent(
    `Oi! Sou ${''}revendedora e gostaria de usar meu saldo como crédito na loja. Meu saldo disponível é ${formatBRL(saldoDisponivel)}.`
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(232,57,106,.15)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'white', borderRadius: '24px 24px 0 0',
          padding: '24px 20px 40px', width: '100%', maxWidth: 430,
          borderTop: '2px solid var(--rosa-border)',
        }}
      >
        <div
          style={{
            width: 40, height: 4, background: 'var(--cinza-light)',
            borderRadius: 2, margin: '0 auto 20px',
          }}
        />

        {etapa === 'sucesso_pix' && (
          <div style={{ textAlign: 'center', padding: '8px 4px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>💸</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: 'var(--texto)', marginBottom: 8 }}>
              Saque solicitado!
            </div>
            <div style={{ fontSize: 14, color: 'var(--cinza)', lineHeight: 1.5, marginBottom: 16 }}>
              Estamos processando seu saque de <b style={{ color: 'var(--texto)' }}>{formatBRL(valorNum)}</b> para a chave Pix informada.
            </div>
            <div style={{ background: 'var(--teal-pale)', border: '1px solid var(--teal-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-dark)', marginBottom: 4 }}>
                ✅ O que acontece agora:
              </div>
              <ul style={{ fontSize: 12, color: 'var(--teal-dark)', lineHeight: 1.6, paddingLeft: 16, margin: 0 }}>
                <li>O valor já foi descontado do seu saldo.</li>
                <li>Vamos processar o pagamento em até <b>1 dia útil</b>.</li>
                <li>Quando estiver pago, você recebe notificação aqui no painel.</li>
              </ul>
            </div>
            <button
              className="btn-rosa"
              type="button"
              onClick={onSucesso}
            >
              Entendi
            </button>
          </div>
        )}

        {etapa === 'credito_loja' && (
          <div style={{ textAlign: 'center', padding: '8px 4px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🛍️</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: 'var(--texto)', marginBottom: 8 }}>
              Crédito na loja
            </div>
            <div style={{ fontSize: 14, color: 'var(--cinza)', lineHeight: 1.5, marginBottom: 16 }}>
              Pra usar seu saldo como crédito na loja, é só mandar uma mensagem pra gente pelo WhatsApp.
            </div>
            <div style={{ background: 'var(--rosa-mist)', border: '1px solid var(--rosa-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--texto)', lineHeight: 1.6 }}>
                Saldo disponível: <b>{formatBRL(saldoDisponivel)}</b>
                <br/>
                A equipe vai aplicar o crédito direto na sua próxima compra ou no seu carrinho.
              </div>
            </div>
            <a
              href={`https://wa.me/${WHATS_ADMIN}?text=${msgWhats}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', background: '#1FAD52', color: 'white', borderRadius: 12,
                padding: '14px 16px', fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              💬 Falar com a Loja de Prata 925
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '100%', background: 'none', border: 'none', color: 'var(--cinza)', fontSize: 13, cursor: 'pointer', padding: 12, marginTop: 4 }}
            >
              Fechar
            </button>
          </div>
        )}

        {etapa === 'form' && (
          <>
            <div style={{ fontFamily: 'Montserrat', fontSize: 18, fontWeight: 900, color: 'var(--texto)', marginBottom: 4 }}>
              Solicitar saque
            </div>
            <div style={{ fontSize: 13, color: 'var(--cinza)', marginBottom: 20 }}>
              Escolha como quer receber
            </div>

            <div
              style={{
                background: 'var(--teal-pale)', border: '1px solid var(--teal-border)',
                borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--teal-dark)', fontWeight: 500 }}>
                Disponível para saque
              </div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 900, color: 'var(--teal-dark)' }}>
                {formatBRL(saldoDisponivel)}
              </div>
            </div>

            <form onSubmit={handleSaque}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { key: 'pix' as const, icon: '⚡', titulo: 'Pix', sub: 'Em até 1 dia útil' },
                  { key: 'credito_loja' as const, icon: '🛍️', titulo: 'Crédito', sub: 'Usar na loja' },
                ].map(op => (
                  <div
                    key={op.key}
                    onClick={() => setTipo(op.key)}
                    style={{
                      border: `2px solid ${tipo === op.key ? 'var(--rosa)' : 'var(--cinza-light)'}`,
                      background: tipo === op.key ? 'var(--rosa-mist)' : 'white',
                      borderRadius: 14, padding: '16px 12px',
                      textAlign: 'center', cursor: 'pointer', transition: 'all .2s',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{op.icon}</div>
                    <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 2 }}>
                      {op.titulo}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--cinza)' }}>{op.sub}</div>
                  </div>
                ))}
              </div>

              {tipo === 'pix' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                      Valor a sacar
                    </label>
                    <input
                      className="input-padrao"
                      type="number"
                      step="0.01"
                      min="1"
                      max={saldoDisponivel}
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                      Sua chave Pix
                    </label>
                    <input
                      className="input-padrao"
                      type="text"
                      placeholder="CPF, e-mail, telefone ou chave aleatória"
                      value={chavePix}
                      onChange={e => setChavePix(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {erro && (
                <div
                  style={{
                    background: 'var(--rosa-mist)', border: '1px solid var(--rosa-border)',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                    fontSize: 13, color: 'var(--rosa)',
                  }}
                >
                  {erro}
                </div>
              )}

              <button className="btn-rosa" type="submit" disabled={loading}>
                {loading
                  ? 'Solicitando...'
                  : tipo === 'pix'
                    ? '✅ Solicitar saque agora'
                    : '💬 Falar com a Loja de Prata 925'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--cinza)', fontSize: 13, cursor: 'pointer', padding: 12, marginTop: 4 }}
              >
                Cancelar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
