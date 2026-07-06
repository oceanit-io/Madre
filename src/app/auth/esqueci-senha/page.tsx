'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { LogoP15 } from '@/components/LogoP15'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    })
    if (error) {
      setErro('Não foi possível enviar agora. Tente novamente em instantes.')
      setLoading(false)
      return
    }
    setEnviado(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff5fa', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #ffd6e6', padding: '16px 20px', textAlign: 'center' }}>
        <LogoP15 altura={34} centro />
        <div style={{ fontSize: 11, color: '#777', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 }}>
          Portal da Revendedora
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, width: '100%', maxWidth: 400 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: '#1D1D1D', marginBottom: 4 }}>
            Recuperar senha
          </div>
          <div style={{ fontSize: 13, color: '#777' }}>
            Te enviamos um link por e-mail para criar uma nova senha
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', border: '1px solid #EDEBE7', width: '100%', maxWidth: 400 }}>
          {enviado ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e6faf3', border: '2px solid #a4e6d2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c9a1" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 17, fontWeight: 800, color: '#1D1D1D', marginBottom: 8 }}>
                E-mail enviado!
              </div>
              <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 18 }}>
                Se existe uma conta com <strong>{email}</strong>, você vai receber um link
                para redefinir sua senha. Confira também o spam.
              </p>
              <Link href="/auth/login" style={{ fontSize: 13, color: '#ff7db4', fontWeight: 600, textDecoration: 'none' }}>
                ← Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                  Seu e-mail
                </label>
                <input
                  className="input-padrao"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {erro && (
                <div style={{ background: '#ffe2ef', border: '1px solid #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff7db4' }}>
                  {erro}
                </div>
              )}

              <button className="btn-rosa" type="submit" disabled={loading}>
                {loading ? 'Enviando...' : '📩 Enviar link de recuperação'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/auth/login" style={{ fontSize: 13, color: '#777', textDecoration: 'none' }}>
                  ← Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
