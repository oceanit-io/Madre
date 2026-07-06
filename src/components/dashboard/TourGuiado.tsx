'use client'
import { useEffect, useState } from 'react'

// Tour interativo simples sem libs externas: spotlight via box-shadow
// (cutout), tooltip absoluta, navegação Next/Skip, salva visto em
// localStorage pra rodar só na 1ª vez. Reabertável pelo /perfil.

type Step = {
  selector: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="saldo"]',
    title: '💰 Seu saldo',
    body:
      'Aqui aparece o que está liberado pra você sacar. O dinheiro de cada venda fica 20 dias em "análise" — esse prazo serve pra cobrir eventuais trocas ou devoluções da venda. Depois libera automaticamente.',
  },
  {
    selector: '[data-tour="link-loja"]',
    title: '🔗 Seu link único',
    body:
      'Esse é o link da SUA loja. Copia e compartilha no WhatsApp, Instagram, grupos da família… Toda compra que sair dele vira sua comissão de 30%.',
  },
  {
    selector: '[data-tour="resumo"]',
    title: '📊 Resumo do mês',
    body:
      'Acompanha quantas comissões você fez no mês e o quanto está prestes a liberar. Atualiza sozinho a cada 20 segundos.',
  },
  {
    selector: '[data-tour="comissoes"]',
    title: '💎 Suas comissões',
    body:
      'Cada venda paga vira uma comissão aqui. Em "Em análise" = ainda nos 20 dias (esperamos esse tempo p/ eventuais trocas/devoluções). "Liberada" = já está no seu saldo, prontinha pra sacar.',
  },
  {
    selector: '[data-tour="bottom-nav"]',
    title: '🧭 Navegação',
    body:
      'Por aqui você acessa sua loja, comissões, saldo e perfil. Bora vender! 🚀',
  },
]

const STORAGE_KEY = 'prata15-tour-dashboard-visto-v1'

export default function TourGuiado() {
  const [step, setStep] = useState<number>(-1)
  const [pos, setPos] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  // Inicia 1× automático. O start manual (pelo /perfil) usa o evento.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY) === 'sim') return
    const t = setTimeout(() => setStep(0), 800)
    return () => clearTimeout(t)
  }, [])

  // Listener pra reabrir do botão do perfil.
  useEffect(() => {
    function reabrir() { setStep(0) }
    window.addEventListener('prata15:tour:start', reabrir)
    return () => window.removeEventListener('prata15:tour:start', reabrir)
  }, [])

  // Calcula posição do elemento atual + scroll até ele.
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return
    const target = document.querySelector(STEPS[step].selector)
    if (!target) {
      // se não achou o elemento, pula
      const t = setTimeout(() => setStep(s => s + 1), 50)
      return () => clearTimeout(t)
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Recalcula após o scroll terminar.
    const t = setTimeout(() => {
      const r = target.getBoundingClientRect()
      setPos({ top: r.top, left: r.left, width: r.width, height: r.height })
    }, 450)
    return () => clearTimeout(t)
  }, [step])

  function next() {
    if (step + 1 >= STEPS.length) finish()
    else setStep(s => s + 1)
  }
  function finish() {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'sim')
    setStep(-1)
    setPos(null)
  }

  if (step < 0 || step >= STEPS.length) return null
  const current = STEPS[step]

  // Posicionamento da tooltip: se o elemento alvo está na metade
  // inferior da tela (onde a tooltip cairia em cima), coloca a tooltip
  // no TOPO. Senão, no bottom (padrão). Evita tampar bottom-nav.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const targetBottom = pos ? pos.top + pos.height : 0
  const tooltipNoTopo = pos !== null && targetBottom > vh - 280

  return (
    <>
      {/* Backdrop escuro clicável que fecha o tour. */}
      <div
        onClick={finish}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.62)',
          zIndex: 9998,
          transition: 'opacity .25s',
        }}
      />

      {/* Spotlight: ring rosa + buraco no overlay usando box-shadow gigante */}
      {pos && (
        <div
          style={{
            position: 'fixed',
            top: pos.top - 8,
            left: pos.left - 8,
            width: pos.width + 16,
            height: pos.height + 16,
            borderRadius: 14,
            // O box-shadow gigante recria o backdrop em volta — efeito de buraco.
            boxShadow: '0 0 0 9999px rgba(0,0,0,.62), 0 0 0 3px #ff7db4, 0 0 30px rgba(232,57,106,.6)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'all .35s cubic-bezier(.4,0,.2,1)',
          }}
        />
      )}

      {/* Tooltip card — topo OU rodapé, depende de onde está o alvo */}
      <div
        style={{
          position: 'fixed',
          zIndex: 10000,
          left: 16,
          right: 16,
          ...(tooltipNoTopo ? { top: 24 } : { bottom: 24 }),
          maxWidth: 440,
          margin: '0 auto',
          background: 'white',
          borderRadius: 18,
          padding: '20px 22px',
          boxShadow: '0 14px 40px rgba(0,0,0,.3)',
          fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 600, letterSpacing: .5, textTransform: 'uppercase' }}>
            Passo {step + 1} de {STEPS.length}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === step ? '#ff7db4' : '#E5E7EB',
                  transition: 'background .2s',
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 800, color: '#1D1D1D', marginBottom: 8 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.55, marginBottom: 18 }}>
          {current.body}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{
              background: 'none',
              border: 'none',
              color: '#777',
              fontSize: 13,
              cursor: 'pointer',
              padding: '10px 8px',
              fontFamily: 'inherit',
            }}
          >
            Pular tour
          </button>
          <button
            onClick={next}
            style={{
              flex: 1,
              background: '#ff7db4',
              color: 'white',
              border: 'none',
              padding: '13px 18px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {step + 1 === STEPS.length ? '✓ Bora vender!' : 'Próximo →'}
          </button>
        </div>
      </div>
    </>
  )
}
