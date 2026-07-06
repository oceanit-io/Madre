'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { validarSenha } from '@/lib/senha'
import PasswordInput from '@/components/PasswordInput'
import SenhaRequisitos, { senhaAtendeRegras } from '@/components/SenhaRequisitos'
import { LogoP15 } from '@/components/LogoP15'

type Estado = 'verificando' | 'pronto' | 'invalido'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setEstado('pronto')
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEstado('pronto')
    })

    // Se em alguns segundos não há sessão, o link é inválido/expirou.
    // 8s pra dar margem em conexão lenta de celular (3.5s dava falso
    // "expirado" antes do token do hash ser processado).
    const t = setTimeout(() => {
      setEstado(prev => (prev === 'verificando' ? 'invalido' : prev))
    }, 8000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const errSenha = validarSenha(senha)
    if (errSenha) {
      setErro(errSenha)
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Não foi possível alterar a senha. O link pode ter expirado — peça outro.')
      setLoading(false)
      return
    }
    setOk(true)
    setLoading(false)
    setTimeout(() => router.replace('/dashboard'), 1800)
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
        <div style={{ background: 'white', borderRadius: 20, padding: '28px 22px', border: '1px solid #EDEBE7', width: '100%', maxWidth: 400 }}>

          {estado === 'verificando' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #ffd6e6', borderTopColor: '#ff7db4', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 13, color: '#777' }}>Verificando o link...</div>
            </div>
          )}

          {estado === 'invalido' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 17, fontWeight: 800, color: '#1D1D1D', marginBottom: 8 }}>
                Link inválido ou expirado
              </div>
              <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 18 }}>
                O link de recuperação não é mais válido. Solicite um novo para
                redefinir sua senha.
              </p>
              <Link href="/auth/esqueci-senha" className="btn-rosa" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                Pedir novo link
              </Link>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <Link href="/auth/login" style={{ fontSize: 13, color: '#777', textDecoration: 'none' }}>
                  ← Voltar ao login
                </Link>
              </div>
            </div>
          )}

          {estado === 'pronto' && (
            ok ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e6faf3', border: '2px solid #a4e6d2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c9a1" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 17, fontWeight: 800, color: '#1D1D1D', marginBottom: 8 }}>
                  Senha alterada! 🎉
                </div>
                <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>
                  Redirecionando para o seu painel...
                </p>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontFamily: 'Montserrat', fontSize: 19, fontWeight: 900, color: '#1D1D1D', marginBottom: 4 }}>
                    Criar nova senha
                  </div>
                  <div style={{ fontSize: 13, color: '#777' }}>
                    Escolha uma senha de pelo menos 6 caracteres
                  </div>
                </div>
                <form onSubmit={salvar}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                      Nova senha
                    </label>
                    <PasswordInput
                      placeholder="Mínimo 6 caracteres"
                      value={senha}
                      onChange={setSenha}
                      required
                      autoComplete="new-password"
                    />
                    <SenhaRequisitos senha={senha} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                      Confirmar nova senha
                    </label>
                    <PasswordInput
                      placeholder="Repita a senha"
                      value={confirmar}
                      onChange={setConfirmar}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {erro && (
                    <div style={{ background: '#ffe2ef', border: '1px solid #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff7db4' }}>
                      {erro}
                    </div>
                  )}

                  <button
                    className="btn-rosa"
                    type="submit"
                    disabled={loading || !senhaAtendeRegras(senha) || senha !== confirmar}
                    style={{
                      opacity: !senhaAtendeRegras(senha) || senha !== confirmar ? 0.5 : 1,
                      cursor: !senhaAtendeRegras(senha) || senha !== confirmar ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Salvando...' : '🔐 Salvar nova senha'}
                  </button>
                </form>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
