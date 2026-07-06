'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { brand } from '@/lib/brand'
import { validarSenha } from '@/lib/senha'
import { validarEmail } from '@/lib/emailValidator'
import Link from 'next/link'
import PasswordInput from '@/components/PasswordInput'
import SenhaRequisitos, { senhaAtendeRegras } from '@/components/SenhaRequisitos'
import { LogoP15 } from '@/components/LogoP15'
import TrackPageView from '@/components/TrackPageView'
import CookieBanner from '@/components/CookieBanner'
import { INFINITEPAY_LINK_DINAMICO } from '@/lib/infinitepayConfig'

// Link estático InfinitePay (criado no painel). Suporta Apple Pay,
// Google Pay, PIX, cartão. Versão API-gerada (lenc=) tem métodos
// limitados, por isso voltamos pro estático.
const LINK_PAGAMENTO = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'


export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [emailJaCadastrado, setEmailJaCadastrado] = useState<null | 'pendente' | 'ativa' | 'suspensa'>(null)
  const [cadastroOk, setCadastroOk] = useState(false)
  const [pagamentoIniciado, setPagamentoIniciado] = useState(false)
  // Link de pagamento: tenta o DINÂMICO (order_nsu=cad_<id>), que ativa a
  // loja sozinho pelo webhook. Cai pro estático se a API do InfinitePay
  // falhar (nesse caso a ativação volta a depender de match/manual).
  const [linkPagamento, setLinkPagamento] = useState(LINK_PAGAMENTO)
  // Aceite da política de privacidade — obrigatório pra LGPD.
  // Salvamos em revendedoras.aceitou_termos_em (timestamp) no insert.
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const [form, setForm] = useState({
    nome: '', email: '', whatsapp: '', cidade: '',
    estado: '', bio: '', senha: '', confirmarSenha: ''
  })

  function update(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  // Gera o link dinâmico (order_nsu=cad_<id>) pra ativação automática.
  // Chamado no handler ANTES de mostrar a tela de pagamento, pra nunca cair
  // no estático por corrida. Fallback estático se a API do InfinitePay falhar.
  async function buscarLinkPagamento(emailArg: string): Promise<string> {
    // Link dinâmico desligado temporariamente (bug do checkout InfinitePay).
    if (!INFINITEPAY_LINK_DINAMICO) return LINK_PAGAMENTO
    try {
      const r = await fetch('/api/auth/criar-pagamento-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg.trim().toLowerCase() }),
      })
      if (r.ok) {
        const d = await r.json()
        if (d?.link) return d.link as string
      }
    } catch { /* mantém fallback estático */ }
    return LINK_PAGAMENTO
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    // Bloqueia typos de e-mail antes de mandar pro Supabase (ex: .comom)
    const errEmail = validarEmail(form.email)
    if (errEmail) {
      setErro(errEmail)
      return
    }

    if (form.senha !== form.confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    const errSenha = validarSenha(form.senha)
    if (errSenha) {
      setErro(errSenha)
      return
    }

    if (!aceitouTermos) {
      setErro('Pra criar a conta tu precisa aceitar a Política de Privacidade.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Email case-insensitive: normaliza pra minúsculas + trim. As pessoas
    // digitam de qualquer jeito (Maiúsculas etc.) — tudo que grava/consulta
    // usa essa versão, pra não travar nem duplicar cadastro.
    const email = form.email.trim().toLowerCase()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: form.senha,
    })

    if (authError || !authData.user) {
      // Traduz erro real do Supabase pra mensagem útil em PT-BR.
      // Antes mostrava sempre "email já cadastrado" o que confundia
      // (ex: senha fraca caia na mesma mensagem genérica).
      const msg = (authError?.message || '').toLowerCase()
      let amigavel = 'Erro ao criar conta. Tente novamente.'
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
        // Antes só dizia "use outro email" o que era confuso — ela talvez
        // já tenha cadastrado e só não pagou. Checa status real e mostra
        // CTA específico (pagar / login / suporte).
        try {
          const r = await fetch('/api/auth/status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email }),
          })
          const j = await r.json()
          if (j?.status === 'pendente' || j?.status === 'ativa' || j?.status === 'suspensa') {
            if (j.status === 'pendente') setLinkPagamento(await buscarLinkPagamento(form.email))
            setEmailJaCadastrado(j.status)
            setLoading(false)
            return
          }
        } catch { /* fall through */ }
        amigavel = 'Esse e-mail já tem conta. Faça login ou use outro e-mail.'
      } else if (msg.includes('password') && msg.includes('weak')) {
        amigavel = 'Crie uma senha com pelo menos 6 caracteres.'
      } else if (msg.includes('password') && (msg.includes('compromised') || msg.includes('breach') || msg.includes('hibp') || msg.includes('pwned'))) {
        amigavel = 'Tenta outra senha (essa já vazou em algum site). Mínimo 6 caracteres.'
      } else if (msg.includes('password')) {
        amigavel = 'Crie uma senha com pelo menos 6 caracteres.'
      } else if (msg.includes('invalid') && msg.includes('email')) {
        amigavel = 'E-mail inválido. Confira a digitação.'
      } else if (msg.includes('rate limit')) {
        amigavel = 'Muitas tentativas. Aguarde 1 minuto e tente de novo.'
      } else if (authError?.message) {
        // Mensagem do Supabase em inglês mas pelo menos vê o motivo real
        amigavel = `Erro: ${authError.message}`
      }
      setErro(amigavel)
      setLoading(false)
      return
    }

    const subdominio = form.nome
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20)

    const { error: profileError } = await supabase
      .from('revendedoras')
      .insert({
        user_id: authData.user.id,
        nome: form.nome,
        email,
        whatsapp: form.whatsapp,
        cidade: form.cidade,
        estado: form.estado,
        bio: form.bio,
        subdominio: `${subdominio}-${Date.now().toString().slice(-4)}`,
        status: 'pendente',
        aceitou_termos_em: new Date().toISOString(),
      })

    if (profileError) {
      // Índice único no banco (revendedoras_email_lower_uniq) garante que
      // NÃO existam 2 contas pro mesmo email (case-insensitive). Se bater
      // aqui, é cadastro duplicado: mostra a tela "já cadastrado" com o
      // status real, em vez de um erro genérico que confunde.
      const dup = profileError.code === '23505' ||
        /duplicate key|revendedoras_email_lower_uniq/i.test(profileError.message || '')
      if (dup) {
        try {
          const r = await fetch('/api/auth/status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const j = await r.json()
          const st = j?.status
          if (st === 'pendente' || st === 'ativa' || st === 'suspensa') {
            if (st === 'pendente') setLinkPagamento(await buscarLinkPagamento(email))
            setEmailJaCadastrado(st)
            setLoading(false)
            return
          }
        } catch { /* fall through */ }
        setErro('Esse e-mail já tem conta. Faça login ou use a opção "Esqueci a senha".')
        setLoading(false)
        return
      }
      setErro('Erro ao criar perfil. Tente novamente.')
      setLoading(false)
      return
    }

    // Email "cadastro recebido" com link de pagamento — best-effort,
    // se falhar não trava o fluxo. Roda em background sem await.
    fetch('/api/auth/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: form.nome }),
    }).catch(() => { /* silencioso */ })

    // Deixa o link dinâmico pronto ANTES de mostrar a tela de pagamento,
    // pra a ativação ser automática (sem corrida com o estático).
    setLinkPagamento(await buscarLinkPagamento(form.email))
    setCadastroOk(true)
    setLoading(false)
  }

  // TELA "EMAIL JÁ CADASTRADO" — quando a pessoa tenta de novo
  // ao invés de erro genérico, mostra exatamente o que falta fazer
  if (emailJaCadastrado) {
    const isPendente = emailJaCadastrado === 'pendente'
    const isAtiva = emailJaCadastrado === 'ativa'
    const isSuspensa = emailJaCadastrado === 'suspensa'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--rosa-pale)', padding: '32px 16px' }}>
        <div className="card fade-up" style={{ maxWidth: 380, margin: '0 auto', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {isPendente ? '💳' : isAtiva ? '✅' : '⚠️'}
          </div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 17, fontWeight: 800, color: 'var(--texto)', marginBottom: 4 }}>
            {isPendente && 'Já tens cadastro!'}
            {isAtiva && 'Tua loja já tá ativa!'}
            {isSuspensa && 'Conta suspensa'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--cinza)', marginBottom: 16, lineHeight: 1.45 }}>
            {isPendente && (<>O e-mail <strong>{form.email}</strong> já tem cadastro. Só falta pagar pra ativar.</>)}
            {isAtiva && (<>O e-mail <strong>{form.email}</strong> já tem loja ativa. Faz login.</>)}
            {isSuspensa && (<>O e-mail <strong>{form.email}</strong> está suspenso. Fala com o suporte.</>)}
          </div>

          {isPendente && (
            <>
              <div style={{ background: 'var(--rosa-pale)', border: '1px dashed var(--rosa-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--rosa)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>
                  Taxa de ativação
                </div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 24, fontWeight: 900, color: 'var(--rosa)', lineHeight: 1 }}>
                  R$ 39,90
                </div>
              </div>
              <a
                href={linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTimeout(() => router.push('/auth/login?paid=1'), 2500)
                }}
                style={{ display: 'block', background: 'var(--rosa)', color: 'white', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, padding: '13px 16px', borderRadius: 10, textDecoration: 'none', marginBottom: 8 }}
              >
                💳 Pagar R$ 39,90
              </a>
              <button
                onClick={() => router.push('/auth/login')}
                style={{ width: '100%', background: 'transparent', border: '1px solid #DDD', color: 'var(--texto)', fontFamily: 'Montserrat', fontWeight: 600, fontSize: 13, padding: 10, borderRadius: 10, cursor: 'pointer', marginBottom: 8 }}
              >
                Já paguei → Entrar
              </button>
            </>
          )}

          {isAtiva && (
            <button
              onClick={() => router.push('/auth/login')}
              style={{ width: '100%', background: 'var(--teal)', color: 'white', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, padding: '13px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 8 }}
            >
              ✅ Entrar agora
            </button>
          )}

          {(isPendente || isSuspensa) && (
            <a
              href={`https://wa.me/5511975427321?text=${encodeURIComponent(`Oi! Tô tentando ${isPendente ? 'pagar' : 'reativar'} meu cadastro. Email: ${form.email}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', fontSize: 12, color: '#25D366', fontWeight: 700, textDecoration: 'none', padding: 8 }}
            >
              💬 Suporte WhatsApp
            </a>
          )}

          <button
            onClick={() => {
              setEmailJaCadastrado(null)
              setErro('')
            }}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#999', fontSize: 11, cursor: 'pointer', padding: 6, marginTop: 4 }}
          >
            ← Usar outro e-mail
          </button>
        </div>
      </div>
    )
  }

  // TELA DE PAGAMENTO (após cadastro exitoso)
  if (cadastroOk) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--rosa-pale)', padding: '32px 16px' }}>
        <div className="card fade-up" style={{ maxWidth: 380, margin: '0 auto', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 17, fontWeight: 800, color: 'var(--texto)', marginBottom: 4 }}>
            Conta criada, {form.nome.split(' ')[0]}!
          </div>
          <div style={{ fontSize: 13, color: 'var(--cinza)', marginBottom: 18, lineHeight: 1.4 }}>
            Falta só o pagamento para ativar tua loja.
          </div>

          <div style={{ background: 'var(--rosa-pale)', border: '1px dashed var(--rosa-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--rosa)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>
              Taxa de ativação
            </div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 24, fontWeight: 900, color: 'var(--rosa)', lineHeight: 1 }}>
              R$ 39,90
            </div>
          </div>

          {!pagamentoIniciado ? (
            <>
              <a
                href={linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setPagamentoIniciado(true)
                  setTimeout(() => router.push('/auth/login?paid=1'), 2500)
                }}
                style={{ display: 'block', background: 'var(--rosa)', color: 'white', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, padding: '13px 16px', borderRadius: 10, textDecoration: 'none', marginBottom: 10 }}
              >
                💳 Pagar R$ 39,90
              </a>
              <div style={{ fontSize: 11, color: 'var(--cinza)', lineHeight: 1.5 }}>
                PIX, Apple Pay, boleto ou cartão (6x sem juros)
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 12px', marginBottom: 12, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 2 }}>
                  ✅ Pagamento aberto em outra aba
                </div>
                <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
                  Termina lá. Quando voltar aqui, clica abaixo.
                </div>
              </div>

              <button
                onClick={() => router.push('/auth/login?paid=1')}
                style={{
                  width: '100%',
                  background: '#10B981',
                  color: 'white',
                  fontFamily: 'Montserrat',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '13px 16px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                ✅ Já paguei → Entrar
              </button>

              <button
                onClick={() => setPagamentoIniciado(false)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 6 }}
              >
                Ainda não paguei
              </button>

              <a
                href="https://wa.me/5511975427321?text=Oi!%20Acabei%20de%20cadastrar%20mas%20tive%20um%20problema%20com%20o%20pagamento"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: 10, fontSize: 12, color: '#25D366', fontWeight: 700, textDecoration: 'none' }}
              >
                💬 Problema? Suporte WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rosa-pale)' }}>
      <TrackPageView pagina="register" />
      <CookieBanner />

      <div style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoP15 altura={30} pill={false} linkHome />
        <div style={{ fontSize: 12, color: 'var(--cinza)' }}>
          Passo {step} de 2
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--rosa-border)' }}>
        <div style={{ height: '100%', background: 'var(--rosa)', width: step === 1 ? '50%' : '100%', transition: 'width .3s' }}/>
      </div>

      <div style={{ padding: '24px 20px 48px', maxWidth: 460, margin: '0 auto', width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: 'var(--texto)', marginBottom: 4 }}>
            {step === 1 ? '🎉 Crie sua loja!' : '🔐 Crie sua senha'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--cinza)' }}>
            {step === 1 ? 'Preencha seus dados para começar' : 'Quase pronto! Defina sua senha de acesso'}
          </div>
        </div>

        <div className="card fade-up" style={{ padding: '22px 20px' }}>
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2) } : handleCadastro}>

            {step === 1 && (
              <>
                {[
                  { label: 'Nome completo', field: 'nome', type: 'text', placeholder: 'Seu nome completo' },
                  { label: 'E-mail', field: 'email', type: 'email', placeholder: 'seu@email.com' },
                  { label: 'WhatsApp', field: 'whatsapp', type: 'tel', placeholder: '(11) 99999-9999' },
                  { label: 'Cidade', field: 'cidade', type: 'text', placeholder: 'São Paulo' },
                  { label: 'Estado', field: 'estado', type: 'text', placeholder: 'SP' },
                ].map(f => (
                  <div key={f.field} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                      {f.label}
                    </label>
                    <input
                      className="input-padrao"
                      type={f.type}
                      placeholder={f.placeholder}
                      value={(form as any)[f.field]}
                      onChange={e => update(f.field, e.target.value)}
                      required
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                    Bio (opcional)
                  </label>
                  <textarea
                    className="input-padrao"
                    placeholder="Conte um pouco sobre você para suas clientes..."
                    value={form.bio}
                    onChange={e => update('bio', e.target.value)}
                    rows={3}
                    style={{ resize: 'none' }}
                  />
                </div>

                <button className="btn-teal" type="submit">
                  Continuar →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ background: 'var(--teal-pale)', border: '1px solid var(--teal-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--teal-dark)', fontWeight: 600, marginBottom: 3 }}>Seu link da loja será:</div>
                  <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--teal-dark)' }}>
                    {form.nome.toLowerCase().replace(/\s+/g, '').slice(0, 15)}.{brand.dominio}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                    Senha
                  </label>
                  <PasswordInput
                    placeholder="Mínimo 6 caracteres"
                    value={form.senha}
                    onChange={v => update('senha', v)}
                    required
                    autoComplete="new-password"
                  />
                  <SenhaRequisitos senha={form.senha} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--texto)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>
                    Confirmar senha
                  </label>
                  <PasswordInput
                    placeholder="Repita a senha"
                    value={form.confirmarSenha}
                    onChange={v => update('confirmarSenha', v)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {/* Aceite LGPD — obrigatório */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, padding: '10px 12px', background: '#FAF8F5', border: '1px solid #EDEBE7', borderRadius: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={aceitouTermos}
                    onChange={e => setAceitouTermos(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--rosa)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--texto)', lineHeight: 1.5 }}>
                    Li e aceito a{' '}
                    <Link href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rosa)', fontWeight: 700, textDecoration: 'underline' }}>
                      Política de Privacidade
                    </Link>
                    . Autorizo o tratamento dos meus dados pessoais conforme a LGPD pra criar minha loja.
                  </span>
                </label>

                {erro && (
                  <div style={{ background: 'var(--rosa-mist)', border: '1px solid var(--rosa-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--rosa)' }}>
                    {erro}
                  </div>
                )}

                <button
                  className="btn-rosa"
                  type="submit"
                  disabled={loading || !senhaAtendeRegras(form.senha) || form.senha !== form.confirmarSenha || !aceitouTermos}
                  style={{
                    marginBottom: 10,
                    opacity: !senhaAtendeRegras(form.senha) || form.senha !== form.confirmarSenha || !aceitouTermos ? 0.5 : 1,
                    cursor: !senhaAtendeRegras(form.senha) || form.senha !== form.confirmarSenha || !aceitouTermos ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Criando sua loja...' : '🚀 Criar minha loja agora!'}
                </button>

                <button type="button" onClick={() => setStep(1)} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--cinza)', fontSize: 13, cursor: 'pointer', padding: 10 }}>
                  ← Voltar
                </button>
              </>
            )}

          </form>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Link href="/auth/login" style={{ fontSize: 13, color: 'var(--cinza)', textDecoration: 'none' }}>
              Já tem conta? <span style={{ color: 'var(--rosa)', fontWeight: 600 }}>Entrar</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}