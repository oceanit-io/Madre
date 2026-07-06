'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { brand } from '@/lib/brand'
import { validarSenha } from '@/lib/senha'
import { validarEmail } from '@/lib/emailValidator'
import PasswordInput, { HINT_SENHA } from '@/components/PasswordInput'
import { PixLogo } from '@/components/PixLogo'
import { LogoP15 } from '@/components/LogoP15'
import MarcaP15 from '@/components/MarcaP15'
import TrackPageView from '@/components/TrackPageView'
import CookieBanner from '@/components/CookieBanner'
import { INFINITEPAY_LINK_DINAMICO } from '@/lib/infinitepayConfig'

// Link estático InfinitePay (criado no painel). Suporta Apple Pay, PIX e cartão.
const LINK_PAGAMENTO = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'

// Fallbacks: usados só se a API de produtos falhar (nunca quebra a página).
const FOTO_FALLBACK = 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800&q=80'
// Mesmo link de pagamento usado em /auth/register (PagBank, R$ 39,90).
// Categorias permitidas no landing (galeria + showcase): peças com bom
// apelo visual e ticket que justifica a comissão de 30%. Outras categorias
// do catálogo (brincos avulsos, pingentes, embalagens, kits, etc.) ficam
// fora p/ não diluir o pitch da revendedora.
const CATEGORIAS_LANDING = new Set(['Conjuntos', 'Aneis', 'Pulseiras'])

export default function LandingPage() {
  // Form completo (mesmos campos de /auth/register: signup real + cadastro
  // de revendedora pendente). Substitui o antigo form de "lead".
  const [form, setForm] = useState({
    nome: '', email: '', whatsapp: '', cidade: '', estado: '', bio: '',
    senha: '', confirmarSenha: '',
  })
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  // Aceite LGPD obrigatório no cadastro.
  const [aceitouTermos, setAceitouTermos] = useState(false)
  // Após clicar "Pagar via PagBank" muda pra true: troca a UI pra
  // mostrar instruções claras + auto-redirect pro login.
  const [pagamentoIniciadoLanding, setPagamentoIniciadoLanding] = useState(false)
  // Link de pagamento: prefere o DINÂMICO (order_nsu=cad_<id>), que ativa a
  // loja sozinho pelo webhook. Buscado no handler ANTES de mostrar a tela de
  // pagamento, pra nunca cair no estático por corrida (causa de ativação
  // manual). Fallback estático só se a API do InfinitePay falhar.
  const [linkPagamento, setLinkPagamento] = useState(LINK_PAGAMENTO)
  const router = useRouter()
  const [emailJaCadastrado, setEmailJaCadastrado] = useState<null | 'pendente' | 'ativa' | 'suspensa'>(null)
  // Popup social-proof (mulher + ganhos via Pix). Aparece 1× por sessão
  // depois de 6s na landing. Dismissable.
  const [popupAberto, setPopupAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [galeria, setGaleria] = useState<string[]>([])
  // Showcase real do catálogo: 2 peças (nome + preço + foto coerentes)
  // p/ a seção "Simulação real" mostrar lucro com produtos de verdade.
  const [showcase, setShowcase] = useState<{ nome: string; preco: number; foto: string }[]>([])

  // Fotos reais do catálogo (best-effort: se falhar, usa fallback).
  // Galeria variada: a API devolve produtos ordenados por destaque + nome,
  // o que clusteriza categorias (todos "Anel..." juntos). Aqui agrupamos
  // por categoria, pegamos até 2 por categoria e embaralhamos — assim a
  // landing mostra a variedade real do catálogo (brincos, colares, anéis,
  // pulseiras...) e não 12 fotos parecidas.
  useEffect(() => {
    let vivo = true
    fetch('/api/produtos')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!vivo || !d) return
        type P = { categoria?: string | null; fotos?: string[]; nome?: string; preco?: number }
        const todos: P[] = Array.isArray(d) ? d : d.produtos || []
        // Só Conjuntos / Aneis / Pulseiras p/ landing — peças que vendem.
        const lista: P[] = todos.filter(p => p.categoria && CATEGORIAS_LANDING.has(p.categoria))
        // Pool por categoria, só com foto.
        const porCat = new Map<string, string[]>()
        for (const p of lista) {
          const foto = p.fotos && p.fotos.length > 0 ? p.fotos[0] : null
          if (!foto) continue
          const cat = p.categoria || 'outras'
          const arr = porCat.get(cat) || []
          arr.push(foto)
          porCat.set(cat, arr)
        }
        // Embaralha dentro de cada categoria, pega até 2.
        const shuffle = <T,>(a: T[]) => {
          const r = [...a]
          for (let i = r.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[r[i], r[j]] = [r[j], r[i]]
          }
          return r
        }
        const picks: string[] = []
        Array.from(porCat.values()).forEach(fotos => picks.push(...shuffle(fotos).slice(0, 2)))
        // Embaralha o resultado final p/ não ficar agrupado por categoria.
        const fotos = shuffle(picks)
        // Fallback de emergência: se o whitelist deu pouquíssimas fotos,
        // expande p/ TODOS os produtos com foto (não deveria acontecer com
        // 700+ peças no whitelist, mas evita que a landing fique vazia).
        if (fotos.length < 4) {
          for (const p of todos) {
            const f = p.fotos && p.fotos.length > 0 ? p.fotos[0] : null
            if (f && !fotos.includes(f)) fotos.push(f)
            if (fotos.length >= 12) break
          }
        }
        setGaleria(fotos.slice(0, 12))

        // Showcase real: 2 produtos com foto + preço razoável (faixa
        // que conta uma boa história de comissão), em categorias diferentes.
        const candidatos = lista.filter(p =>
          p.fotos && p.fotos.length > 0 &&
          typeof p.nome === 'string' && p.nome.length > 0 &&
          typeof p.preco === 'number' && p.preco >= 80 && p.preco <= 500
        )
        const porCatShow = new Map<string, P[]>()
        for (const p of candidatos) {
          const cat = p.categoria || 'outras'
          const arr = porCatShow.get(cat) || []
          arr.push(p)
          porCatShow.set(cat, arr)
        }
        // 1 por categoria (aleatório), embaralha, pega 2.
        const um = Array.from(porCatShow.values()).map(arr => shuffle(arr)[0]).filter(Boolean) as P[]
        const dois = shuffle(um).slice(0, 2)
        if (dois.length === 2) {
          setShowcase(dois.map(p => ({
            nome: p.nome as string,
            preco: p.preco as number,
            foto: (p.fotos as string[])[0],
          })))
        }
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  // Popup social-proof: abre 1× por sessão, 6s depois de entrar.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('lp-popup-visto-v3') === 'sim') return
    const t = setTimeout(() => setPopupAberto(true), 6000)
    return () => clearTimeout(t)
  }, [])

  function fecharPopup() {
    setPopupAberto(false)
    if (typeof window !== 'undefined') sessionStorage.setItem('lp-popup-visto-v3', 'sim')
  }

  function update(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  // Mesma lógica de /auth/register, embarcada no landing: passo 1 = dados;
  // passo 2 = senha + signUp real + insert revendedora pendente. Depois
  // mostra a tela de pagamento PagBank (R$ 39,90) — sem leads, só cadastros
  // reais que vão direto pra pagar.
  // Gera o link dinâmico (order_nsu=cad_<id>) pra ativação automática.
  // Retorna o estático como fallback se a API do InfinitePay falhar.
  async function buscarLinkPagamento(email: string): Promise<string> {
    // Link dinâmico desligado temporariamente (bug do checkout InfinitePay).
    if (!INFINITEPAY_LINK_DINAMICO) return LINK_PAGAMENTO
    try {
      const r = await fetch('/api/auth/criar-pagamento-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (r.ok) {
        const d = await r.json()
        if (d?.link) return d.link as string
      }
    } catch { /* mantém fallback estático */ }
    return LINK_PAGAMENTO
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    // Bloqueia typos de e-mail (ex: .comom) ANTES de avançar
    const errEmail = validarEmail(form.email)
    if (errEmail) { setErro(errEmail); return }

    if (step === 1) { setStep(2); return }

    if (form.senha !== form.confirmarSenha) {
      setErro('As senhas não coincidem.'); return
    }
    const errSenha = validarSenha(form.senha)
    if (errSenha) { setErro(errSenha); return }

    if (!aceitouTermos) {
      setErro('Pra criar a conta tu precisa aceitar a Política de Privacidade.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    // Email case-insensitive: normaliza pra minúsculas + trim (gente digita de
    // qualquer jeito) — não pode travar nem duplicar cadastro.
    const email = form.email.trim().toLowerCase()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password: form.senha,
    })
    if (authError || !authData.user) {
      const msg = (authError?.message || '').toLowerCase()
      // Email já existe → checa status real e mostra tela útil
      // ("já tem cadastro, só falta pagar" / "já tá ativa, faz login").
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
        try {
          const r = await fetch('/api/auth/status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email }),
          })
          const j = await r.json()
          if (j?.status === 'pendente' || j?.status === 'ativa' || j?.status === 'suspensa') {
            // Já tem cadastro e só falta pagar → deixa o link dinâmico pronto.
            if (j.status === 'pendente') setLinkPagamento(await buscarLinkPagamento(form.email))
            setEmailJaCadastrado(j.status)
            setLoading(false)
            return
          }
        } catch { /* fall through */ }
      }
      // Outros erros → mostra mensagem específica
      let amigavel = 'Erro ao criar conta. Tente novamente.'
      if (msg.includes('password') && (msg.includes('weak') || msg.includes('compromised') || msg.includes('breach') || msg.includes('pwned'))) {
        amigavel = 'Tenta outra senha (essa já vazou em algum site). Mínimo 6 caracteres.'
      } else if (msg.includes('password')) {
        amigavel = 'Crie uma senha com pelo menos 6 caracteres.'
      } else if (msg.includes('invalid') && msg.includes('email')) {
        amigavel = 'E-mail inválido. Confira a digitação.'
      } else if (msg.includes('rate limit')) {
        amigavel = 'Muitas tentativas. Aguarde 1 minuto e tente de novo.'
      } else if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
        amigavel = 'Esse e-mail já tem conta. Faça login ou use outro.'
      }
      setErro(amigavel)
      setLoading(false); return
    }
    const slug = form.nome
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '').slice(0, 20)
    const { error: profileError } = await supabase.from('revendedoras').insert({
      user_id: authData.user.id,
      nome: form.nome, email, whatsapp: form.whatsapp,
      cidade: form.cidade, estado: form.estado, bio: form.bio,
      subdominio: `${slug}-${Date.now().toString().slice(-4)}`,
      status: 'pendente',
      aceitou_termos_em: new Date().toISOString(),
    })
    if (profileError) {
      // Índice único no banco impede 2 contas pro mesmo email. Se bater
      // aqui é cadastro duplicado: orienta login/recuperar senha em vez de
      // erro genérico.
      const dup = profileError.code === '23505' ||
        /duplicate key|revendedoras_email_lower_uniq/i.test(profileError.message || '')
      setErro(dup
        ? 'Esse e-mail já tem conta. Faça login ou use "Esqueci a senha".'
        : 'Erro ao criar perfil. Tente novamente.')
      setLoading(false); return
    }
    // Deixa o link dinâmico pronto ANTES de mostrar a tela de pagamento,
    // pra a ativação ser automática (sem corrida com o estático).
    setLinkPagamento(await buscarLinkPagamento(form.email))
    setSucesso(true)
    setLoading(false)
  }

  function scrollForm() {
    document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth' })
  }

  const passos = [
    { n: '01', titulo: '📋 Crie sua conta', desc: 'Preencha o formulário e pague R$ 39,90 (PIX, boleto ou cartão). Em poucos minutos sua loja com +3.000 itens fica ativa.' },
    { n: '02', titulo: '📲 Compartilhe sua loja', desc: 'Mande seu link para amigas, família e grupos do WhatsApp. Sua cliente clica, escolhe e compra direto da sua loja.' },
    { n: '03', titulo: '📦 Nós cuidamos de tudo', desc: 'Embalamos e entregamos direto para sua cliente. Você não precisa estocar nem despachar nada.' },
    { n: '04', titulo: '💸 Receba 30% via Pix', desc: 'Sua comissão libera 20 dias após o pagamento da venda (segurança anti-fraude e devoluções). Depois disso, saca direto pelo painel.' },
  ]

  // Produtos reais do catálogo (com seu próprio nome/preço/foto) quando
  // a API responder; se ainda não veio (ou se algo falhou), cai num
  // fallback p/ a página nunca ficar "quebrada".
  const produtos = showcase.length === 2 ? showcase : [
    { nome: 'Pulseira em prata 925', preco: 150, foto: galeria[1] || FOTO_FALLBACK },
    { nome: 'Conjunto colar + brinco', preco: 300, foto: galeria[2] || galeria[0] || FOTO_FALLBACK },
  ]

  const depoimentos = [
    { ini: 'M', cor: '#ff7db4', nome: 'Maria Fernanda', info: 'São Paulo, SP · 3 meses', txt: '"Comecei sem gastar nada, só compartilhei o link no grupo da família. Em 2 semanas já tinha R$630 de comissão. Sem sair de casa!"' },
    { ini: 'J', cor: '#22c9a1', nome: 'Juliana Costa', info: 'Guarulhos, SP · 2 meses', txt: '"A mensalidade paguei com a venda do primeiro conjunto. Minha loja tem +3.000 peças e não preciso comprar nada, a Prata 925 cuida de tudo!"' },
  ]

  return (
    <div className="lp">
      <TrackPageView pagina="landing" />
      <CookieBanner />
      <style>{`
        .lp { width: 100%; overflow-x: hidden; color: #1D1D1D; font-family: 'Poppins', sans-serif; background: #fff; }
        .lp img { display: block; }
        .lp-band { width: 100%; }
        .lp-wrap { max-width: 460px; margin: 0 auto; padding: 40px 22px; }
        .lp-eyebrow { display: inline-flex; align-items: center; gap: 6px; border-radius: 30px; padding: 6px 14px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
        .lp-h2 { font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 900; text-transform: uppercase; line-height: 1.22; letter-spacing: -0.2px; margin-bottom: 6px; }
        .lp-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: none; cursor: pointer; font-family: 'Montserrat',sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; border-radius: 14px; }

        /* ---------- TOP BAR ---------- */
        .lp-topbar { max-width: 1080px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .lp-topbar-logo { flex-shrink: 0; }
        .lp-login-btn { flex-shrink: 0; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #ff7db4; text-decoration: none; padding: 8px 14px; border-radius: 20px; border: 1.5px solid #ffd6e6; background: #ffe2ef; white-space: nowrap; }
        /* Texto curto em telas estreitas; completo a partir de 480px. */
        .lp-login-full { display: none; }
        @media (min-width: 480px) { .lp-login-full { display: inline; } .lp-login-short { display: none; } }

        /* ---------- WATERMARKS P15 ----------
           Marca d'água: diamante rosa repetido em fundo bem desbotado.
           Reforça branding sem competir com o conteúdo. */
        .lp-watermark {
          position: absolute; inset: 0; pointer-events: none;
          background-image: url('/branding/diamante-p15.svg');
          background-size: 110px 110px;
          background-repeat: space;
          background-position: center;
          opacity: .055;
        }
        .lp-watermark-big {
          position: absolute; pointer-events: none;
          background-image: url('/branding/diamante-p15.svg');
          background-repeat: no-repeat;
          background-size: contain;
          opacity: .08;
        }

        /* ---------- HERO ---------- */
        .hero { background: #fff5fa; border-bottom: 3px solid #ffd6e6; position: relative; overflow: hidden; }
        .hero-dots { position: absolute; inset: 0; background-image: radial-gradient(circle,rgba(255,125,180,.10) 1.5px,transparent 1.5px); background-size: 22px 22px; pointer-events: none; }
        .hero-grid { position: relative; max-width: 460px; margin: 0 auto; padding: 28px 18px 0; text-align: center; }
        .hero h1 { font-family: 'Montserrat',sans-serif; font-size: 26px; font-weight: 900; line-height: 1.18; letter-spacing: -0.3px; margin-bottom: 10px; text-transform: uppercase; }
        .hero p { font-size: 14px; color: #777; line-height: 1.65; max-width: 360px; margin: 0 auto 14px; }
        .hero-3m { background: #ff7db4; border-radius: 16px; padding: 14px 16px; margin: 0 0 16px; display: flex; align-items: center; gap: 10px; text-align: left; }
        /* iPhone SE / Mini (≤375px): reduz tudo um chouto pra caber sem horizontal scroll */
        @media (max-width: 380px) {
          .hero-grid { padding: 22px 14px 0; }
          .hero h1 { font-size: 23px; line-height: 1.18; }
          .hero p { font-size: 13.5px; }
          .hero-3m { padding: 12px 14px; gap: 10px; }
          .lp-wrap { padding: 32px 16px; }
        }
        .hero-cta-desk { display: none; }
        .hero-img-wrap { position: relative; }
        .hero-img { width: 100%; height: 260px; object-fit: cover; }
        .hero-badge { position: absolute; background: #fff; border-radius: 14px; padding: 10px 13px; display: flex; align-items: center; gap: 8px; box-shadow: 0 6px 24px rgba(232,57,106,.18); border: 1.5px solid #ffd6e6; }

        /* ---------- STATS ---------- */
        .stats { background: #ff7db4; padding: 16px; }
        .stats-in { max-width: 760px; margin: 0 auto; display: flex; justify-content: space-around; }

        /* ---------- VALOR ---------- */
        .valor { background: #e6faf3; border-top: 2px solid #a4e6d2; border-bottom: 2px solid #a4e6d2; }
        .valor .lp-wrap { text-align: center; max-width: 720px; }
        .feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

        /* ---------- COMO FUNCIONA ---------- */
        .como { background: #fff; }
        .steps-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .step { display: flex; gap: 14px; align-items: flex-start; background: #FAF8F5; border: 1.5px solid #ffd6e6; border-radius: 16px; padding: 16px; position: relative; overflow: hidden; }
        .step-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #22c9a1; }
        .step-n { font-family: 'Montserrat',sans-serif; font-size: 34px; font-weight: 900; color: rgba(11,191,160,.18); line-height: 1; flex-shrink: 0; min-width: 40px; text-align: center; }

        /* ---------- SIMULAÇÃO ---------- */
        .sim { background: #fff5fa; border-top: 2px solid #ffd6e6; border-bottom: 2px solid #ffd6e6; }
        .prod-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
        .prod-card { background: #fff; border: 1.5px solid #ffd6e6; border-radius: 16px; overflow: hidden; }
        .prod-card img { width: 100%; height: 160px; object-fit: cover; }
        .sim-box { background: #ffe2ef; border: 1.5px solid #ffd6e6; border-radius: 16px; padding: 20px; }

        /* ---------- DEPOIMENTOS ---------- */
        .depo { background: #FAF8F5; }
        .depo-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .depo-card { background: #fff; border-radius: 16px; padding: 18px; border: 1px solid #EDEBE7; border-left: 4px solid #22c9a1; }

        .gal { background: #fff; }
        .lp-gal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .lp-gal img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: #FAF8F5; border: 1px solid #ffd6e6; }

        /* ---------- FORM ---------- */
        .form-sec { background: #ff7db4; position: relative; overflow: hidden; }
        .form-dots { position: absolute; inset: 0; background-image: radial-gradient(circle,rgba(255,255,255,.08) 1.5px,transparent 1.5px); background-size: 22px 22px; pointer-events: none; }
        /* Base mobile: sem isto o bloco "Abra sua loja" fica colado nas bordas. */
        .form-wrap2 { position: relative; max-width: 460px; margin: 0 auto; padding: 40px 22px; }
        .form-card { background: #fff; border-radius: 20px; padding: 22px; }
        .f-2 { display: grid; grid-template-columns: 1fr; gap: 0 14px; }
        .f-input { width: 100%; background: #FAF8F5; border: 2px solid #EDEBE7; border-radius: 12px; padding: 13px 16px; font-family: 'Poppins',sans-serif; font-size: 14px; color: #1D1D1D; outline: none; }

        /* ---------- FOOTER ---------- */
        .lp-footer { padding: 24px; text-align: center; background: #fff5fa; border-top: 2px solid #ffd6e6; }

        /* ---------- STICKY CTA (mobile) ---------- */
        .sticky-cta { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: rgba(255,255,255,.97); backdrop-filter: blur(12px); border-top: 2px solid #ffd6e6; padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 100; }

        /* ====================================================
           DESKTOP  (≥ 880px) — layout real, mobile fica intacto
           ==================================================== */
        @media (min-width: 880px) {
          .lp { background: #F7EAEF; }
          .lp-wrap { max-width: 1080px; padding: 64px 40px; }
          .lp-h2 { font-size: 34px; }

          .hero { border-bottom-width: 4px; }
          .hero-grid { max-width: 1080px; padding: 72px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; text-align: left; }
          .hero h1 { font-size: 52px; }
          .hero p { font-size: 17px; max-width: none; margin: 0 0 22px; }
          .hero-3m { padding: 20px 24px; }
          .hero-cta-desk { display: flex; max-width: 360px; padding: 17px; font-size: 16px; background: #22c9a1; color: #fff; margin-top: 4px; }
          .hero-img { height: 460px; border-radius: 20px; }

          .stats-in { max-width: 1080px; }
          .stats-in > div > div:first-child { font-size: 26px !important; }

          .valor .lp-wrap { max-width: 880px; }
          .feat-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }

          .steps-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .step { flex-direction: column; }

          .prod-grid { grid-template-columns: 1fr 1fr; gap: 20px; max-width: 880px; margin: 0 auto 20px; }
          .prod-card img { height: 220px; }
          .sim-box { max-width: 620px; margin: 0 auto; }

          .depo-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
          .lp-gal { grid-template-columns: repeat(6, 1fr); gap: 12px; }

          .form-wrap2 { max-width: 1080px; margin: 0 auto; padding: 64px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
          .form-card { max-width: none; }
          .f-2 { grid-template-columns: 1fr 1fr; }

          .sticky-cta { display: none; }
          .lp-footer { padding: 32px; }
        }
        @media (min-width: 880px) {
          .hero-cta-mob { display: none; }
        }
      `}</style>

      {/* ══ TOP BAR minimal — marca + login pra quem já tem conta ══ */}
      <div style={{ background: 'white', borderBottom: '1px solid #ffd6e6' }}>
        <div className="lp-topbar">
          <span className="lp-topbar-logo"><LogoP15 altura={36} linkHome /></span>
          <a href="/auth/login" className="lp-login-btn">
            <span className="lp-login-short">Entrar →</span>
            <span className="lp-login-full">Já tenho minha loja → entrar</span>
          </a>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="lp-band hero">
        <div className="hero-dots" />
        <div className="hero-grid">
          <div>
            <div className="lp-eyebrow" style={{ background: '#22c9a1', color: '#fff' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              Revendedora Prata 925 · Sem estoque inicial
            </div>
            <h1>
              Vire revendedora<br />
              da <span style={{ color: '#ff7db4' }}>Prata 925</span> e ganhe 30%!
            </h1>
            <p>
              Comece <strong style={{ color: '#1D1D1D' }}>sem investimento em estoque</strong>. Você compartilha o link da sua loja, a Prata 925 entrega direto pra sua cliente, você recebe a comissão via Pix. <strong style={{ color: '#1D1D1D' }}>Trabalha pelo celular</strong>.
            </p>
            <div className="hero-3m">
              <div style={{ fontSize: 28, flexShrink: 0 }}>🏪</div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', marginBottom: 3, fontWeight: 600 }}>Loja avaliada em</div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.12, letterSpacing: -0.3 }}>R$ 3.000.000</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>por apenas <strong style={{ color: '#5DD9C1' }}>R$39,90/mês</strong>. isso é real.</div>
              </div>
            </div>

            {/* Selo P15 — reforça credibilidade do fornecedor */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
              <MarcaP15 variante="badge" texto="Catálogo oficial Prata 15" />
            </div>

            <button className="lp-btn hero-cta-desk" onClick={scrollForm}>🚀 Quero minha loja agora!</button>
          </div>

          <div className="hero-img-wrap">
            <img className="hero-img" src="/branding/landing-vendedora.jpg" alt="Revendedora brasileira contando lucro das vendas em joias 925" />
            {/* Só 2 badges complementares — a foto conta a história sozinha */}
            <div className="hero-badge" style={{ top: 12, left: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
              <div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 800, color: '#ff7db4', lineHeight: 1 }}>30%</div>
                <div style={{ fontSize: 9.5, color: '#777', fontWeight: 500, lineHeight: 1.2 }}>de comissão</div>
              </div>
            </div>
            <div className="hero-badge" style={{ top: 12, right: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
              <div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 800, color: '#1FAD52', lineHeight: 1 }}>+3.000 itens</div>
                <div style={{ fontSize: 9.5, color: '#777', fontWeight: 500, lineHeight: 1.2 }}>no catálogo</div>
              </div>
            </div>
            <div className="hero-badge" style={{ bottom: 12, right: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e6faf3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🛡️</div>
              <div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 800, color: '#1ba78a', lineHeight: 1 }}>Sem estoque</div>
                <div style={{ fontSize: 9.5, color: '#777', fontWeight: 500, lineHeight: 1.2 }}>você só vende</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="lp-band stats">
        <div className="stats-in">
          {[['30%','comissão/venda'],['R$0','investimento'],['3mil+','itens na loja'],['R$39','por mês']].map(([v,l], i) => (
            <div key={i} style={{ textAlign: 'center', flex: 1, borderRight: i < 3 ? '1px solid rgba(255,255,255,.25)' : 'none' }}>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 3 }}>{v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.75)', lineHeight: 1.3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VALOR 3M */}
      <section className="lp-band valor" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="lp-watermark" />
        <div className="lp-wrap" style={{ position: 'relative' }}>
          <div className="lp-eyebrow" style={{ background: '#fff', color: '#1ba78a', border: '1px solid #a4e6d2' }}>🏪 Sua loja virtual</div>
          <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, color: '#777', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Uma loja avaliada em</div>
          <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 46, fontWeight: 900, color: '#1D1D1D', lineHeight: 1.08, letterSpacing: -0.5, marginBottom: 6 }}>
            R$3<span style={{ color: '#1ba78a' }}> milhões</span>
          </div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 22, lineHeight: 1.6 }}>
            +3.000 itens de prata 925 · estoque nosso · <strong style={{ color: '#1D1D1D' }}>sua marca</strong>
          </div>
          <div style={{ background: '#ff7db4', borderRadius: 16, padding: '18px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', marginBottom: 4 }}>Tudo isso por apenas</div>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: -0.3 }}>
                <sup style={{ fontSize: 14, verticalAlign: 'top', marginTop: 8, display: 'inline-block' }}>R$</sup>39<span style={{ fontSize: 15, letterSpacing: 0, fontWeight: 600 }}>,99/mês</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', lineHeight: 1.5 }}>cancele</div>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 800, color: '#fff' }}>QUANDO</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', lineHeight: 1.5 }}>quiser</div>
            </div>
          </div>
          <div className="feat-grid">
            {[['🏪','Loja +3.000 itens'],['📦','Nós enviamos tudo'],['💰','30% de comissão'],['🎯','Suporte + bônus']].map(([ic, tx], i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #a4e6d2', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{ic}</span>
                <span style={{ fontSize: 12, color: '#1D1D1D', fontWeight: 500, lineHeight: 1.3 }}>{tx}</span>
              </div>
            ))}
          </div>
          <button className="lp-btn" onClick={scrollForm} style={{ background: '#22c9a1', color: '#fff', fontSize: 16, padding: 17, marginTop: 18 }}>
            🚀 Quero minha loja agora!
          </button>
        </div>
      </section>

      {/* GALERIA DE PEÇAS REAIS */}
      {galeria.length >= 4 && (
        <section className="lp-band gal">
          <div className="lp-wrap" style={{ textAlign: 'center' }}>
            <div className="lp-eyebrow" style={{ background: '#ffe2ef', color: '#ff7db4', border: '1px solid #ffd6e6' }}>💎 Peças reais</div>
            <h2 className="lp-h2">Peças reais da <span style={{ color: '#ff7db4' }}>sua loja</span></h2>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 22 }}>
              Prata 925 legítima. Fotos reais do catálogo que você vai vender.
            </p>
            <div className="lp-gal">
              {galeria.slice(0, 12).map((src, i) => (
                <img key={i} src={src} alt={`Peça de prata 925 #${i + 1}`} loading="lazy" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COMO FUNCIONA */}
      <section className="lp-band como" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="lp-watermark-big" style={{ width: 260, height: 260, top: -40, right: -60 }} />
        <div className="lp-watermark-big" style={{ width: 200, height: 200, bottom: -30, left: -50 }} />
        <div className="lp-wrap" style={{ position: 'relative' }}>
          <div className="lp-eyebrow" style={{ background: '#e6faf3', color: '#1ba78a', border: '1px solid #a4e6d2' }}>✅ Como funciona</div>
          <h2 className="lp-h2">4 passos <span style={{ color: '#ff7db4' }}>simples</span></h2>
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 24 }}>Do cadastro ao primeiro Pix em menos de 1 semana.</p>
          <div className="steps-grid">
            {passos.map(p => (
              <div key={p.n} className="step">
                <div className="step-bar" />
                <div className="step-n">{p.n}</div>
                <div>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, color: '#1D1D1D', marginBottom: 3 }}>{p.titulo}</div>
                  <div style={{ fontSize: 12, color: '#777', lineHeight: 1.5 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIMULAÇÃO */}
      <section className="lp-band sim" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="lp-watermark" style={{ opacity: .04 }} />
        <div className="lp-wrap" style={{ position: 'relative' }}>
          <div className="lp-eyebrow" style={{ background: '#ffe2ef', color: '#ff7db4', border: '1px solid #ffd6e6' }}>💸 Simulação real</div>
          <h2 className="lp-h2">Veja o <span style={{ color: '#ff7db4' }}>lucro real</span></h2>
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 20 }}>Ticket médio de R$300. Veja o que entra na sua conta.</p>
          <div className="prod-grid">
            {produtos.map(p => (
              <div key={p.nome} className="prod-card">
                <img src={p.foto} alt="" />
                <div style={{ padding: '14px 16px 16px' }}>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, color: '#1D1D1D', marginBottom: 12 }}>{p.nome}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[['Preço', `R$${Math.round(p.preco)}`, '#777'],['Comissão','30%','#777'],['Você recebe',`R$${Math.round(p.preco * 0.3)}`, '#1ba78a']].map(([l,v,c],i) => (
                      <div key={i} style={{ background: '#FAF8F5', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>{l}</div>
                        <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 15, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#22c9a1', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'white', borderRadius: 6, padding: '3px 6px', display: 'inline-flex', alignItems: 'center' }}>
                        <PixLogo size={16} />
                      </span>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.95)', fontWeight: 600 }}>sua comissão via Pix</div>
                    </div>
                    <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 900, color: '#fff' }}>R${Math.round(p.preco * 0.3)} 🤑</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="sim-box">
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, color: '#ff7db4', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 14 }}>
              📊 Simulação mensal · ticket médio R$300
            </div>
            {[['10 vendas × R$300','+R$900'],['20 vendas × R$300','+R$1.800'],['30 vendas × R$300','+R$2.700']].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffd6e6' }}>
                <span style={{ fontSize: 13, color: '#777' }}>{l}</span>
                <span style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 800, color: '#1ba78a' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffd6e6' }}>
              <span style={{ fontSize: 13, color: '#777' }}>Mensalidade da loja</span>
              <span style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, color: '#aaa', textDecoration: 'line-through' }}>−R$39,90</span>
            </div>
            <div style={{ background: '#ff7db4', borderRadius: 12, padding: '14px 16px', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', fontWeight: 500 }}>Lucro líquido (30 vendas/mês)</div>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.3, lineHeight: 1.1 }}>R$2.660</div>
            </div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="lp-band depo">
        <div className="lp-wrap">
          <div className="lp-eyebrow" style={{ background: '#e6faf3', color: '#1ba78a', border: '1px solid #a4e6d2' }}>⭐ Quem já é revendedora</div>
          <h2 className="lp-h2" style={{ marginBottom: 20 }}>Elas já <span style={{ color: '#22c9a1' }}>começaram</span></h2>
          <div className="depo-grid">
            {depoimentos.map(d => (
              <div key={d.nome} className="depo-card">
                <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                  {'★★★★★'.split('').map((s, i) => <span key={i} style={{ fontSize: 15, color: '#ff7db4' }}>★</span>)}
                </div>
                <p style={{ fontSize: 13, color: '#1D1D1D', lineHeight: 1.65, fontStyle: 'italic', marginBottom: 12 }}>{d.txt}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: d.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat,sans-serif', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{d.ini}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1D' }}>{d.nome}</div>
                    <div style={{ fontSize: 11, color: '#777' }}>{d.info}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ GATILHOS EMOCIONAIS — fala direto com a mulher que quer
            empreender. P15 como marca real + sonho realizável. ══ */}
      <section className="lp-band" style={{ background: '#fff5fa', position: 'relative', overflow: 'hidden', borderTop: '2px solid #ffd6e6', borderBottom: '2px solid #ffd6e6' }}>
        <div className="lp-watermark-big" style={{ width: 360, height: 360, top: -80, right: -100 }} />
        <div className="lp-watermark-big" style={{ width: 220, height: 220, bottom: -40, left: -60 }} />
        <div className="lp-wrap" style={{ position: 'relative', maxWidth: 760, textAlign: 'center' }}>
          <div className="lp-eyebrow" style={{ background: '#fff', color: '#ff7db4', border: '1px solid #ffd6e6' }}>
            💖 Pra você que quer empreender
          </div>
          <h2 className="lp-h2" style={{ marginBottom: 14 }}>
            Você não precisa de <span style={{ color: '#ff7db4' }}>capital</span>.<br/>
            Precisa de <span style={{ color: '#22c9a1' }}>coragem</span>.
          </h2>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, maxWidth: 580, margin: '0 auto 28px' }}>
            Sem investir em estoque. Sem alugar ponto. Sem se prender em horário. Só você, seu celular e uma <strong style={{ color: '#1D1D1D' }}>loja inteira de prata 925</strong> nas suas mãos.
          </p>

          {/* Grid de gatilhos — cada um aborda um medo/sonho real */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28, textAlign: 'left',
          }}>
            {[
              { ic: '👩‍👧', t: 'Mãe que quer estar em casa', d: 'Trabalha do sofá, sem deixar de cuidar dos filhos.' },
              { ic: '💸', t: 'Quer renda extra de verdade', d: '30% por venda. Quanto mais você divulga, mais comissão.' },
              { ic: '🏠', t: 'Sem patrão, sem horário', d: 'Você decide quando posta, quando responde, quando descansa.' },
              { ic: '🚀', t: 'Sem investimento inicial', d: 'A Prata 925 envia a peça. Você não compra estoque, não corre risco.' },
              { ic: '✨', t: 'Marca real e conhecida', d: 'A Prata 925 já tem milhares de clientes. Você herda essa confiança.' },
              { ic: '📱', t: 'Tudo pelo celular', d: 'Cadastrou, pegou o link, postou no WhatsApp e Instagram. Pronto.' },
            ].map((g, i) => (
              <div key={i} style={{
                background: '#fff', border: '1.5px solid #ffd6e6', borderRadius: 16,
                padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: '#ffe2ef', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>{g.ic}</div>
                <div>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, color: '#1D1D1D', marginBottom: 4, lineHeight: 1.25 }}>
                    {g.t}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#777', lineHeight: 1.55 }}>
                    {g.d}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quote final emocional + logo P15 assina */}
          <div style={{
            background: 'linear-gradient(135deg, #ff7db4 0%, #d4579a 100%)',
            borderRadius: 18, padding: '22px 24px', color: '#fff',
            boxShadow: '0 12px 30px rgba(255,125,180,.32)',
            maxWidth: 580, margin: '0 auto',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>💎</div>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, letterSpacing: -0.2 }}>
              &ldquo;A sua independência financeira começa com a primeira venda.&rdquo;
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: .92, letterSpacing: .5, textTransform: 'uppercase' }}>
              Bem-vinda à família Prata 925
            </div>
          </div>
        </div>
      </section>

      {/* ══ FORMULÁRIO ══ */}
      <section id="cadastro" className="lp-band form-sec">
        <div className="form-dots" />
        <div className="form-wrap2">
          <div>
            <div className="lp-eyebrow" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>🚀 Crie sua loja</div>
            <h2 className="lp-h2" style={{ color: '#fff' }}>Abra sua loja <span style={{ color: '#e6faf3' }}>agora!</span></h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.9)', marginBottom: 20, lineHeight: 1.6, maxWidth: 460 }}>
              <strong style={{ color: '#fff' }}>Como funciona o pagamento:</strong><br/>
              ✓ <strong>R$ 39,90</strong> via PIX, boleto ou cartão.<br/>
              Sem riscos: se a gente não aprovar seu cadastro, devolvemos o valor.
            </p>
          </div>

          {emailJaCadastrado ? (
            <div className="form-card" style={{ padding: '22px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>
                {emailJaCadastrado === 'pendente' ? '💳' : emailJaCadastrado === 'ativa' ? '✅' : '⚠️'}
              </div>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 17, fontWeight: 800, color: '#1D1D1D', marginBottom: 4 }}>
                {emailJaCadastrado === 'pendente' && 'Já tens cadastro!'}
                {emailJaCadastrado === 'ativa' && 'Tua loja já tá ativa!'}
                {emailJaCadastrado === 'suspensa' && 'Conta suspensa'}
              </div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 14, lineHeight: 1.45 }}>
                {emailJaCadastrado === 'pendente' && (<>O e-mail <strong>{form.email}</strong> já tem cadastro. Só falta pagar pra ativar.</>)}
                {emailJaCadastrado === 'ativa' && (<>O e-mail <strong>{form.email}</strong> já tem loja ativa. Faz login.</>)}
                {emailJaCadastrado === 'suspensa' && (<>O e-mail <strong>{form.email}</strong> está suspenso. Fala com o suporte.</>)}
              </div>

              {emailJaCadastrado === 'pendente' && (
                <>
                  <div style={{ background: '#ffe2ef', border: '1px dashed #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#ff7db4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>
                      Taxa de ativação
                    </div>
                    <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 24, fontWeight: 900, color: '#ff7db4', lineHeight: 1 }}>
                      R$ 39,90
                    </div>
                  </div>
                  <a
                    href={linkPagamento}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', background: '#ff7db4', color: '#fff', fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, padding: '13px 16px', borderRadius: 10, textDecoration: 'none', marginBottom: 8 }}
                  >
                    💳 Pagar R$ 39,90
                  </a>
                  <a
                    href="/auth/login?paid=1"
                    style={{ display: 'block', background: 'transparent', border: '1px solid #DDD', color: '#1D1D1D', fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, padding: 10, borderRadius: 10, textDecoration: 'none', marginBottom: 8 }}
                  >
                    Já paguei → Entrar
                  </a>
                </>
              )}

              {emailJaCadastrado === 'ativa' && (
                <a
                  href="/auth/login"
                  style={{ display: 'block', background: '#22c9a1', color: '#fff', fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, padding: '13px 16px', borderRadius: 10, textDecoration: 'none', marginBottom: 8 }}
                >
                  ✅ Entrar agora
                </a>
              )}

              {(emailJaCadastrado === 'pendente' || emailJaCadastrado === 'suspensa') && (
                <a
                  href={`https://wa.me/5511975427321?text=${encodeURIComponent(`Oi! Tô tentando ${emailJaCadastrado === 'pendente' ? 'pagar' : 'reativar'} meu cadastro. Email: ${form.email}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', fontSize: 12, color: '#25D366', fontWeight: 700, textDecoration: 'none', padding: 8 }}
                >
                  💬 Suporte WhatsApp
                </a>
              )}

              <button
                onClick={() => { setEmailJaCadastrado(null); setErro(''); setStep(1) }}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#999', fontSize: 11, cursor: 'pointer', padding: 6, marginTop: 4 }}
              >
                ← Usar outro e-mail
              </button>
            </div>
          ) : !sucesso ? (
            <div className="form-card">
              <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700, marginBottom: 14 }}>
                Passo {step} de 2 · {step === 1 ? 'Seus dados' : 'Crie sua senha'}
              </div>
              <form onSubmit={enviar}>
                {step === 1 && (
                  <>
                    <div className="f-2">
                      {[
                        { label: '👤 Nome completo', field: 'nome', type: 'text', placeholder: 'Seu nome completo' },
                        { label: '📧 E-mail', field: 'email', type: 'email', placeholder: 'seu@email.com' },
                        { label: '📱 Seu WhatsApp', field: 'whatsapp', type: 'tel', placeholder: 'Ex: (11) 98765-4321' },
                        { label: '📍 Cidade', field: 'cidade', type: 'text', placeholder: 'São Paulo' },
                        { label: '🗺️ Estado (UF)', field: 'estado', type: 'text', placeholder: 'SP' },
                      ].map(f => (
                        <div key={f.field} style={{ marginBottom: 14 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>{f.label}</label>
                          <input className="f-input" type={f.type} placeholder={f.placeholder} value={(form as Record<string,string>)[f.field]} onChange={e => update(f.field, e.target.value)} required />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>📝 Bio (opcional)</label>
                      <textarea className="f-input" placeholder="Conte um pouco sobre você para suas clientes..." value={form.bio} onChange={e => update('bio', e.target.value)} rows={3} style={{ resize: 'none' }} />
                    </div>
                    {erro && (
                      <div style={{ background: '#ffe2ef', border: '1px solid #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ff7db4' }}>
                        {erro}
                      </div>
                    )}
                    <button type="submit" className="lp-btn" style={{ background: '#22c9a1', color: '#fff', fontSize: 16, padding: 17 }}>
                      Continuar →
                    </button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div style={{ background: '#e6faf3', border: '1px solid #a4e6d2', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: '#1ba78a', fontWeight: 600, marginBottom: 3 }}>Seu link da loja vai ser:</div>
                      <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 800, color: '#1ba78a', wordBreak: 'break-all' }}>
                        {brand.dominio}/loja/{form.nome.toLowerCase().replace(/\s+/g, '').slice(0, 15) || 'sualoja'}…
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>🔐 Senha</label>
                      <PasswordInput
                        className="f-input"
                        placeholder="Mínimo 8, com letra e número"
                        value={form.senha}
                        onChange={v => update('senha', v)}
                        required
                        autoComplete="new-password"
                        hint={HINT_SENHA}
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 7, textTransform: 'uppercase', letterSpacing: .3 }}>🔐 Confirmar senha</label>
                      <PasswordInput
                        className="f-input"
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
                        style={{ marginTop: 2, accentColor: '#ff7db4', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: '#1D1D1D', lineHeight: 1.5 }}>
                        Li e aceito a{' '}
                        <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: '#ff7db4', fontWeight: 700, textDecoration: 'underline' }}>
                          Política de Privacidade
                        </a>
                        . Autorizo o tratamento dos meus dados pessoais conforme a LGPD pra criar minha loja.
                      </span>
                    </label>

                    {erro && (
                      <div style={{ background: '#ffe2ef', border: '1px solid #ffd6e6', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ff7db4' }}>
                        {erro}
                      </div>
                    )}
                    <button type="submit" disabled={loading || !aceitouTermos} className="lp-btn" style={{ background: '#ff7db4', color: '#fff', fontSize: 16, padding: 17, cursor: loading || !aceitouTermos ? 'not-allowed' : 'pointer', opacity: loading || !aceitouTermos ? .7 : 1, marginBottom: 10 }}>
                      {loading ? '⏳ Criando sua loja...' : '🚀 Criar minha loja agora!'}
                    </button>
                    <button type="button" onClick={() => setStep(1)} style={{ width: '100%', background: 'none', border: 'none', color: '#777', fontSize: 13, cursor: 'pointer', padding: 10 }}>
                      ← Voltar
                    </button>
                  </>
                )}

                <p style={{ textAlign: 'center', fontSize: 11, color: '#777', marginTop: 14, lineHeight: 1.5 }}>🔒 Seus dados são tratados conforme a LGPD.</p>
              </form>
            </div>
          ) : (
            <div className="form-card" style={{ padding: '32px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 900, color: '#1D1D1D', marginBottom: 6 }}>
                Conta criada, {form.nome.split(' ')[0]}!
              </div>
              <div style={{ fontSize: 14, color: '#777', marginBottom: 20, lineHeight: 1.5 }}>
                Só falta um passo para ativar sua loja 💎
              </div>
              <div style={{ background: '#ffe2ef', border: '2px dashed #ffd6e6', borderRadius: 14, padding: '20px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#ff7db4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Sua loja por
                </div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 36, fontWeight: 900, color: '#ff7db4', lineHeight: 1, marginBottom: 4 }}>
                  R$ 39,90
                </div>
                <div style={{ fontSize: 12, color: '#777' }}>
                  Pagamento único. Sem aprovação = devolvemos.
                </div>
              </div>
              {!pagamentoIniciadoLanding ? (
                <>
                  <div style={{ textAlign: 'left', background: '#FAF8F5', border: '1px solid #EDEBE7', borderRadius: 12, padding: 14, marginBottom: 18, fontSize: 13, color: '#1D1D1D', lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Como funciona:</div>
                    <div>1️⃣ Clica no botão e abre o checkout</div>
                    <div>2️⃣ Paga com PIX, boleto ou cartão (até 6x)</div>
                    <div>3️⃣ Em poucos minutos ativamos sua conta</div>
                    <div>4️⃣ Você recebe a confirmação e já pode vender ✨</div>
                  </div>
                  <a
                    href={linkPagamento}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setPagamentoIniciadoLanding(true)
                      setTimeout(() => router.push('/auth/login?paid=1'), 2500)
                    }}
                    className="lp-btn"
                    style={{ background: '#ff7db4', color: '#fff', fontSize: 15, padding: 16, textDecoration: 'none', marginBottom: 10 }}
                  >
                    💳 Pagar agora
                  </a>
                  <a href="/auth/login?paid=1" style={{ display: 'block', textAlign: 'center', background: 'none', border: 'none', color: '#777', fontSize: 13, padding: 10, textDecoration: 'none' }}>
                    Já paguei, ir para login →
                  </a>
                  <div style={{ marginTop: 12, fontSize: 11, color: '#777', lineHeight: 1.5 }}>
                    Ao pagar você confirma sua conta. Seus dados são tratados conforme a LGPD.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: '#ECFDF5', border: '2px solid #10B981', borderRadius: 14, padding: 16, marginBottom: 14, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 800, color: '#065F46', marginBottom: 4 }}>
                      ✅ Checkout aberto em outra aba
                    </div>
                    <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.5 }}>
                      Termina o pagamento lá. Em alguns segundos te levamos pra tela de login.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/auth/login?paid=1')}
                    className="lp-btn"
                    style={{ background: '#10B981', color: '#fff', fontSize: 15, padding: 16, marginBottom: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                  >
                    ✅ Já paguei → Entrar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagamentoIniciadoLanding(false)}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 6 }}
                  >
                    Ainda não paguei
                  </button>
                  <a
                    href="https://wa.me/5511975427321?text=Oi!%20Acabei%20de%20cadastrar%20mas%20tive%20um%20problema%20com%20o%20pagamento"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12, color: '#25D366', fontWeight: 700, textDecoration: 'none', padding: 6 }}
                  >
                    💬 Problema? Suporte WhatsApp
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div style={{ marginBottom: 14 }}>
          <LogoP15 altura={32} centro />
        </div>

        {/* Selo "Catálogo oficial fornecido por Prata 15" */}
        <div style={{ marginBottom: 16, paddingTop: 14, borderTop: '1px solid #FFD6E6' }}>
          <MarcaP15 variante="hero" />
        </div>

        <div style={{ fontSize: 11, color: '#777', lineHeight: 1.6 }}>
          {brand.nome} · Operado por {brand.operadora}
        </div>
        <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5, marginTop: 8, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          Seus dados são tratados conforme a LGPD (Lei 13.709/2018) e usados apenas
          para contato sobre a sua loja. Você pode solicitar correção ou exclusão
          a qualquer momento.
        </div>
        <div style={{ marginTop: 12, fontSize: 11 }}>
          <a href="/privacidade" style={{ color: '#ff7db4', textDecoration: 'underline', fontWeight: 600 }}>
            Política de Privacidade
          </a>
        </div>
      </footer>

      {/* Sticky CTA (mobile only) */}
      <div className="sticky-cta">
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="https://wa.me/5511975427321?text=Oi!%20Quero%20saber%20mais%20sobre%20ser%20revendedora%20Loja%20de%20Prata%20925" target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1FAD52', color: '#fff', fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 800, padding: 13, borderRadius: 12, textDecoration: 'none', textTransform: 'uppercase' }}>
            Whats
          </a>
          <button onClick={scrollForm} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#ff7db4', color: '#fff', fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 800, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}>
            🚀 ABRIR MINHA LOJA AGORA!
          </button>
        </div>
      </div>

      {/* ══ POPUP social-proof — paleta oficial P15 ══
          Cores do site pratade15reais.com.br: rosa #ff7db4 (marca),
          rosa hover #d4579a, texto #1D1D1D, teal Pix #22c9a1.
          Tipografia Montserrat (300–600). */}
      {popupAberto && (
        <>
          <div
            onClick={fecharPopup}
            style={{
              position: 'fixed', inset: 0,
              background: 'radial-gradient(circle at 50% 40%, rgba(255,125,180,.18) 0%, rgba(0,0,0,.78) 80%)',
              zIndex: 9998, animation: 'fadeIn .3s',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            style={{
              position: 'fixed', zIndex: 9999,
              left: 12, right: 12, top: '50%',
              transform: 'translateY(-50%)',
              maxWidth: 460, margin: '0 auto',
              background: '#fff', borderRadius: 28,
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(255,125,180,.35), 0 12px 32px rgba(0,0,0,.35)',
              animation: 'popIn .35s cubic-bezier(.34,1.56,.64,1)',
              maxHeight: '94vh', overflowY: 'auto',
              border: '1px solid #ffe2ef',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            <button
              onClick={fecharPopup}
              aria-label="Fechar"
              style={{
                position: 'absolute', top: 12, right: 12, zIndex: 3,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.95)', color: '#1D1D1D',
                border: '1px solid #ffd6e6', cursor: 'pointer',
                fontSize: 20, lineHeight: 1, fontWeight: 400,
                boxShadow: '0 4px 12px rgba(0,0,0,.18)',
              }}
            >×</button>

            {/* Selo da marca P15 — assina o popup como sendo da casa */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 2,
              background: 'rgba(255,255,255,.96)',
              borderRadius: 999, padding: '6px 10px 6px 8px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,.18)',
              border: '1px solid #ffd6e6',
            }}>
              <span style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 900, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: -0.3 }}>
                Prata <span style={{ color: '#ff7db4' }}>925</span>
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#ff7db4', textTransform: 'uppercase', letterSpacing: 1 }}>
                Revendedoras
              </span>
            </div>

            {/* Foto real: cliente mostrando "PIX Pagamento recebido" */}
            <div style={{ position: 'relative', height: 340, background: '#111' }}>
              <img
                src="/branding/popup-pix.jpg"
                alt="Cliente pagando uma joia via Pix"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
              />
              {/* Gradiente leve no rodapé p/ chip ficar legível */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.42) 100%)',
                pointerEvents: 'none',
              }} />
              {/* Chip Pix com logo oficial + valor — flutua sobre a foto */}
              <div style={{
                position: 'absolute', bottom: 16, left: 16, right: 16,
                background: 'rgba(255,255,255,.97)', borderRadius: 18,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 10px 28px rgba(0,0,0,.28)',
                border: '1px solid rgba(34,201,161,.25)',
              }}>
                <div style={{
                  background: '#f0fbf7', borderRadius: 12, padding: '8px 10px',
                  border: '1px solid #d3f1e7',
                  display: 'inline-flex', alignItems: 'center',
                }}>
                  <PixLogo size={26} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                    Pagamento recebido
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#22c9a1', lineHeight: 1, letterSpacing: -0.3 }}>
                    + R$ 1.247,30
                  </div>
                </div>
                <div aria-hidden style={{ fontSize: 20 }}>✨</div>
              </div>
            </div>

            <div style={{ padding: '24px 26px 26px', textAlign: 'center', position: 'relative' }}>
              {/* Ornamento decorativo: diamantezinhos rosa — só no desktop */}
              <span aria-hidden style={{ position: 'absolute', top: 14, left: 18, fontSize: 14, color: '#ffd6e6' }}>💎</span>
              <span aria-hidden style={{ position: 'absolute', top: 14, right: 18, fontSize: 14, color: '#ffd6e6' }}>💎</span>

              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#ff7db4', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
                ⚡ Saque na hora via Pix
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1D', lineHeight: 1.25, marginBottom: 14, letterSpacing: -0.3 }}>
                Suas vendas viram <span style={{ color: '#ff7db4', fontWeight: 600 }}>Pix direto</span><br/>
                no seu <span style={{ color: '#22c9a1', fontWeight: 600 }}>CPF</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#555', lineHeight: 1.65, marginBottom: 22 }}>
                Compartilha o link da sua loja, a cliente paga, você acompanha tudo pelo celular. <strong style={{ color: '#1D1D1D', fontWeight: 600 }}>30% de comissão</strong> em cada venda, libera em 20 dias depois.
              </div>
              <button
                onClick={() => {
                  fecharPopup()
                  document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ff7db4 0%, #d4579a 100%)',
                  color: 'white',
                  border: 'none', borderRadius: 14,
                  padding: '16px 20px', fontSize: 15, fontWeight: 600,
                  fontFamily: 'Montserrat,sans-serif',
                  cursor: 'pointer', textTransform: 'uppercase',
                  letterSpacing: 1,
                  boxShadow: '0 10px 24px rgba(255,125,180,.4)',
                  transition: 'transform .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                Quero ser revendedora Prata 925
              </button>
              <button
                onClick={fecharPopup}
                style={{
                  display: 'block', margin: '10px auto 0',
                  background: 'none', border: 'none',
                  color: '#999', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Agora não
              </button>
            </div>
          </div>
          <style jsx>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes popIn { from { opacity: 0; transform: translateY(-50%) scale(.85) } to { opacity: 1; transform: translateY(-50%) scale(1) } }
          `}</style>
        </>
      )}

    </div>
  )
}
