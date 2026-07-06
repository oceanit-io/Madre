'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import PasswordInput from '@/components/PasswordInput'
import { LogoP15 } from '@/components/LogoP15'

export default function LoginPage() {
  const router = useRouter()
  // Lê ?paid=1 via window.location em useEffect — useSearchParams
  // exige <Suspense> em App Router e quebrava o build inteiro,
  // bloqueando todos os deploys da Vercel.
  const [pagamentoRecebido, setPagamentoRecebido] = useState(false)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    // Detecta pagamento por: nosso flag ?paid=1 OU pelos params que
    // o InfinitePay anexa ao redirect (slug + transaction_nsu).
    const veioDoInfinitePay = !!sp.get('slug') && !!sp.get('transaction_nsu')
    if (sp.get('paid') === '1' || veioDoInfinitePay) setPagamentoRecebido(true)
  }, [])
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  // "Lembrar email" — preenche email automático no próximo login.
  // Senha NUNCA salva por segurança (browser/Supabase já gerencia
  // sessão persistente automaticamente).
  const [lembrarEmail, setLembrarEmail] = useState(false)

  // Auto-preenche email salvo da última vez (se ela marcou lembrar)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lembrar-email')
      if (saved) {
        setEmail(saved)
        setLembrarEmail(true)
      }
    } catch { /* */ }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    // Email case-insensitive: normaliza pra minúsculas + trim. As pessoas
    // digitam de qualquer jeito (Maiúsculas, espaço no fim) e isso NÃO pode
    // travar login nem criar perfil duplicado.
    const emailNorm = email.trim().toLowerCase()

    // Salva/remove email salvo conforme escolha "lembrar"
    try {
      if (lembrarEmail) localStorage.setItem('lembrar-email', emailNorm)
      else localStorage.removeItem('lembrar-email')
    } catch { /* */ }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password: senha
    })

    if (error || !data.user) {
      setErro('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Se voltou do InfinitePay com params do redirect (slug + transaction_nsu),
    // confirma pagamento via API deles e ativa a conta automaticamente.
    // Anti-fraude: o payment_check confirma se o pagamento existe de verdade.
    try {
      const sp = new URLSearchParams(window.location.search)
      const slug = sp.get('slug') || ''
      const transaction_nsu = sp.get('transaction_nsu') || ''
      const order_nsu = sp.get('order_nsu') || ''
      if (slug && transaction_nsu) {
        await fetch('/api/auth/confirmar-pagamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailNorm, slug, transaction_nsu, order_nsu }),
        }).catch(() => { /* silencioso */ })
      }
    } catch { /* */ }

    // Verifica se tem perfil, se não, cria um básico
    const { data: rev } = await supabase
      .from('revendedoras')
      .select('id, nome_loja, foto_url, cor_tema, fonte, cor_fundo, status')
      .ilike('email', emailNorm)
      .single()

    if (!rev) {
      // Cria perfil básico se não existe
      await supabase.from('revendedoras').insert({
        user_id: data.user.id,
        nome: emailNorm.split('@')[0],
        email: emailNorm,
        whatsapp: '',
        subdominio: emailNorm.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() + Date.now().toString().slice(-4),
        status: 'pendente',
      })
      // Recém-cadastrada → vai direto configurar a loja.
      router.push('/configurar-loja')
      return
    }

    // Atualiza user_id se necessário
    await supabase
      .from('revendedoras')
      .update({ user_id: data.user.id })
      .ilike('email', emailNorm)

    // Se for pendente, notifica admin em background pra ela reagir rápido
    // (talvez a pessoa pagou e tá esperando ativar). Não bloqueia o login.
    if (rev.status === 'pendente') {
      fetch('/api/auth/pendente-logou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => { /* silencioso */ })
    }

    // Onboarding: se ainda não personalizou NADA (todos os campos
    // opcionais de loja vazios), leva pra /configurar-loja em vez do
    // dashboard direto. Quem já personalizou alguma vez vai pro
    // dashboard normalmente.
    const naoPersonalizou =
      !rev.nome_loja &&
      !rev.foto_url &&
      !rev.cor_tema &&
      !rev.fonte &&
      !rev.cor_fundo
    if (rev.status === 'ativa' && naoPersonalizou) {
      router.push('/configurar-loja')
      return
    }

    router.push('/dashboard')
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
        {pagamentoRecebido && (
          <div style={{
            width: '100%', maxWidth: 400, marginBottom: 20,
            background: '#ECFDF5', border: '2px solid #10B981',
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 28 }}>🎉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: '#065F46', marginBottom: 2 }}>
                Pagamento recebido!
              </div>
              <div style={{ fontSize: 11, color: '#047857', lineHeight: 1.4 }}>
                Sua conta será ativada em poucos minutos. Faça login pra acompanhar.
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24, width: '100%', maxWidth: 400 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ff7db4', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: '#1D1D1D', marginBottom: 4 }}>
            Bem-vinda de volta!
          </div>
          <div style={{ fontSize: 13, color: '#777' }}>
            Entre para acessar sua loja e comissões
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', border: '1px solid #EDEBE7', width: '100%', maxWidth: 400 }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>E-mail</label>
              <input className="input-padrao" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required/>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>Senha</label>
              <PasswordInput
                placeholder="Sua senha"
                value={senha}
                onChange={setSenha}
                required
                autoComplete="current-password"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1D' }}>
                <input
                  type="checkbox"
                  checked={lembrarEmail}
                  onChange={e => setLembrarEmail(e.target.checked)}
                  style={{ accentColor: '#ff7db4', width: 16, height: 16, cursor: 'pointer' }}
                />
                Lembrar meu e-mail
              </label>
              <Link href="/auth/esqueci-senha" style={{ fontSize: 13, color: '#ff7db4', textDecoration: 'underline', fontWeight: 600 }}>
                Esqueci a senha
              </Link>
            </div>

            {erro && (
              <div style={{ background: '#ffe2ef', border: '1px solid #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff7db4' }}>
                {erro}
              </div>
            )}

            <button className="btn-rosa" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : '🔑 Entrar na minha conta'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 12, paddingTop: 14, borderTop: '1px solid #EDEBE7' }}>
            <Link href="/auth/register" style={{ fontSize: 13, color: '#1ba78a', fontWeight: 600, textDecoration: 'none' }}>
              Ainda não é revendedora? Cadastre-se →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}