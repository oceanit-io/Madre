'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCarrinho, chaveItem } from '@/contexts/CarrinhoContext'
import { brand } from '@/lib/brand'

// ---------- Helpers ----------
function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarCPF(cpfRaw: string): boolean {
  const cpf = (cpfRaw || '').replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf[9], 10)) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf[10], 10)) return false
  return true
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`
  return d
}

// ---------- Campo de formulario ----------
function Campo({
  label,
  value,
  onChange,
  onBlur,
  erro,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  disabled,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  erro?: string | null
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'email' | 'numeric' | 'tel'
  autoComplete?: string
  disabled?: boolean
  maxLength?: number
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={maxLength}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 12,
          border: `1px solid ${erro ? '#DC2626' : '#EEE'}`,
          background: disabled ? '#F5F5F5' : 'white',
          fontSize: 14,
          color: '#1A1A1A',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {erro && (
        <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{erro}</div>
      )}
    </div>
  )
}

type ServicoFrete = 'PAC' | 'SEDEX' | 'PADRAO'

type OpcaoFrete = {
  servico: ServicoFrete
  valor: number
  gratis: boolean
  prazo_dias_min: number
  prazo_dias_max: number
  origem: 'correios' | 'tabela'
}

type FreteResp = {
  regiao: string
  opcoes: OpcaoFrete[]
}

const NOMES_SERVICO: Record<ServicoFrete, string> = {
  PAC: 'PAC',
  SEDEX: 'SEDEX',
  PADRAO: 'Correios',
}

export default function CheckoutPage() {
  const router = useRouter()
  const { itens, remover } = useCarrinho()

  // Itens selecionados no carrinho (estilo Shopee): só compramos esses; o
  // resto fica no carrinho. As chaves vêm do sessionStorage gravado no
  // carrinho. Sem seleção (entrou direto), compra tudo.
  const [selKeys, setSelKeys] = useState<Set<string> | null>(null)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('prata15_checkout_sel')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length) setSelKeys(new Set(arr.map(String)))
      }
    } catch {
      /* ignore */
    }
  }, [])
  const itensFiltrados = selKeys ? itens.filter(i => selKeys.has(chaveItem(i))) : itens
  const itensCheckout = itensFiltrados.length ? itensFiltrados : itens
  const subtotal = itensCheckout.reduce((a, i) => a + i.preco * i.quantidade, 0)
  const totalItens = itensCheckout.reduce((a, i) => a + i.quantidade, 0)

  // Cor da loja pro botão de confirmar — segue o tema escolhido pela revendedora.
  const slugLoja = itensCheckout[0]?.slugRevendedora
  const [corLoja, setCorLoja] = useState('#1A1A1A')
  useEffect(() => {
    if (!slugLoja) return
    fetch(`/api/loja/${slugLoja}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && /^#[0-9a-fA-F]{6}$/.test(d.cor_tema || '')) setCorLoja(d.cor_tema) })
      .catch(() => {})
  }, [slugLoja])

  // Dados pessoais
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')

  // Endereço
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [tocado, setTocado] = useState<Record<string, boolean>>({})
  const [cepLoading, setCepLoading] = useState(false)
  const [cepErro, setCepErro] = useState<string | null>(null)

  const [freteResp, setFreteResp] = useState<FreteResp | null>(null)
  const [freteLoading, setFreteLoading] = useState(false)
  const [servicoEscolhido, setServicoEscolhido] = useState<ServicoFrete | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  const submetidoRef = useRef(false)
  const [prontoParaVerificar, setProntoParaVerificar] = useState(false)

  const cepDigits = cep.replace(/\D/g, '')
  const telDigits = telefone.replace(/\D/g, '')

  // Esperar a que el CarrinhoContext hidrate desde localStorage antes
  // de decidir si el carrinho está realmente vacío.
  useEffect(() => {
    const t = setTimeout(() => setProntoParaVerificar(true), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (prontoParaVerificar && itens.length === 0 && !submetidoRef.current) {
      router.replace('/carrinho')
    }
  }, [prontoParaVerificar, itens.length, router])

  // Buscar endereço por CEP (ViaCEP via /api/cep)
  useEffect(() => {
    if (cepDigits.length !== 8) {
      setCepErro(null)
      return
    }
    let cancelado = false
    setCepLoading(true)
    setCepErro(null)
    fetch(`/api/cep/${cepDigits}`)
      .then(async res => {
        if (cancelado) return
        if (!res.ok) {
          setCepErro('CEP não encontrado, preencha manualmente.')
          return
        }
        const data = await res.json()
        if (cancelado) return
        if (data.logradouro) setRua(data.logradouro)
        if (data.bairro) setBairro(data.bairro)
        if (data.localidade) setCidade(data.localidade)
        if (data.uf) setUf(String(data.uf).toUpperCase().slice(0, 2))
      })
      .catch(() => {
        if (!cancelado) setCepErro('CEP não encontrado, preencha manualmente.')
      })
      .finally(() => {
        if (!cancelado) setCepLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [cepDigits])

  // Calcular frete cuando hay UF + CEP válidos. Pide opções (PAC/SEDEX) ao
  // backend, que consulta Correios PPN se houver env vars [[lib-correios]],
  // ou cai pra tabela fixa por região.
  useEffect(() => {
    const ufLimpa = uf.trim().toUpperCase()
    if (ufLimpa.length !== 2 || cepDigits.length !== 8) {
      setFreteResp(null)
      setServicoEscolhido(null)
      return
    }
    let cancelado = false
    setFreteLoading(true)
    fetch('/api/frete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uf: ufLimpa, cep: cepDigits, subtotal, qntItens: totalItens }),
    })
      .then(async res => {
        if (cancelado) return
        if (!res.ok) {
          setFreteResp(null)
          return
        }
        const data = (await res.json()) as FreteResp
        if (!cancelado) {
          setFreteResp(data)
          // Pré-seleciona PAC (mais barato) ou a primeira opção disponível,
          // mas preserva a escolha do usuário se ele já clicou e o serviço
          // ainda existir nas opções novas.
          setServicoEscolhido(prev => {
            if (prev && data.opcoes.some(o => o.servico === prev)) return prev
            const pac = data.opcoes.find(o => o.servico === 'PAC')
            return pac?.servico ?? data.opcoes[0]?.servico ?? null
          })
        }
      })
      .catch(() => {
        if (!cancelado) setFreteResp(null)
      })
      .finally(() => {
        if (!cancelado) setFreteLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [uf, cepDigits, subtotal, totalItens])

  const opcaoSelecionada: OpcaoFrete | null =
    freteResp?.opcoes.find(o => o.servico === servicoEscolhido) ?? null

  // Validaciones
  const erros = useMemo(() => {
    return {
      nome: nome.trim().split(/\s+/).filter(Boolean).length >= 2 ? null : 'Informe seu nome completo',
      email: EMAIL_RE.test(email.trim()) ? null : 'E-mail inválido',
      cpf: validarCPF(cpf) ? null : 'CPF inválido',
      telefone: telDigits.length === 10 || telDigits.length === 11 ? null : 'Telefone inválido',
      cep: cepDigits.length === 8 ? null : 'CEP inválido',
      rua: rua.trim() ? null : 'Informe a rua',
      numero: numero.trim() ? null : 'Informe o número',
      bairro: bairro.trim() ? null : 'Informe o bairro',
      cidade: cidade.trim() ? null : 'Informe a cidade',
      uf: uf.trim().length === 2 ? null : 'UF inválida',
    }
  }, [nome, email, cpf, telDigits, cepDigits, rua, numero, bairro, cidade, uf])

  const formValido =
    Object.values(erros).every(e => e === null) &&
    opcaoSelecionada !== null &&
    !freteLoading &&
    itensCheckout.length > 0

  const total = subtotal + (opcaoSelecionada?.valor ?? 0)

  function marcarTocado(campo: string) {
    setTocado(prev => ({ ...prev, [campo]: true }))
  }

  function err(campo: keyof typeof erros) {
    return tocado[campo] ? erros[campo] : null
  }

  async function handleSubmit() {
    setTocado({
      nome: true, email: true, cpf: true, telefone: true,
      cep: true, rua: true, numero: true, bairro: true, cidade: true, uf: true,
    })
    if (!formValido || enviando) return

    // Defesa: o pedido tem que ser de uma única loja. Se por algum motivo o
    // carrinho misturou lojas (ou perdeu o slug), barra aqui — senão a venda
    // seria atribuída à revendedora errada (ou a nenhuma).
    const slugsLoja = Array.from(
      new Set(itensCheckout.map(i => i.slugRevendedora).filter(Boolean))
    )
    if (slugsLoja.length !== 1) {
      setErroEnvio(
        'Seu carrinho tem itens de lojas diferentes. Volte ao carrinho e finalize uma loja por vez.'
      )
      return
    }
    const slugRevendedora = slugsLoja[0]

    setEnviando(true)
    setErroEnvio(null)

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: {
            nome: nome.trim(),
            email: email.trim(),
            cpf,
            telefone,
          },
          endereco: {
            cep,
            rua: rua.trim(),
            numero: numero.trim(),
            complemento: complemento.trim(),
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            uf: uf.trim().toUpperCase(),
          },
          itens: itensCheckout.map(i => ({
            id: i.id,
            quantidade: i.quantidade,
            foto: i.foto,
            variantId: i.variantId,
            variacao: i.variacao,
            ref: i.ref,
          })),
          frete_servico: servicoEscolhido,
          slugRevendedora,
          observacoes: observacoes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.id) {
        setErroEnvio(data?.erro || 'Não foi possível criar o pedido. Tente novamente.')
        setEnviando(false)
        return
      }

      submetidoRef.current = true
      // Remove só os itens comprados; o resto FICA no carrinho (estilo Shopee).
      itensCheckout.forEach(i => remover(chaveItem(i)))
      try { sessionStorage.removeItem('prata15_checkout_sel') } catch { /* ignore */ }
      router.push(`/pedido/${data.id}/aguardando-pagamento`)
    } catch (e) {
      setErroEnvio('Erro de conexão. Verifique sua internet e tente novamente.')
      setEnviando(false)
    }
  }

  if (!prontoParaVerificar || itens.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ fontSize: 13, color: '#999', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
          Carregando...
        </div>
      </div>
    )
  }

  const passos = ['Dados', 'Endereço', 'Pagamento']

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, "Inter", sans-serif' }}>
      <style>{`
        .checkout-grid { display: grid; grid-template-columns: 1fr; gap: 28px; align-items: start; }
        @media (min-width: 900px) {
          .checkout-grid { grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; }
          .checkout-resumo { position: sticky; top: 24px; }
        }
        .checkout-2col { display: grid; grid-template-columns: 1fr; gap: 0 16px; }
        @media (min-width: 560px) {
          .checkout-2col { grid-template-columns: 1fr 1fr; }
        }
        /* Mobile compaction: reduz padding lateral pra peças longas (frete,
           preço, "Entrega em X-Y dias úteis") caberem sem cortar. */
        .checkout-wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
        .checkout-card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #EEE; margin-bottom: 20px; }
        @media (max-width: 640px) {
          .checkout-wrap { padding: 20px 18px; }
          .checkout-card { padding: 16px; }
        }
        @media (max-width: 400px) {
          .checkout-wrap { padding: 16px 16px; }
        }
        /* Opção de frete: layout flexível pra não cortar valor em telas
           pequenas. Quando muito apertado, info empilha sobre o preço. */
        .frete-opt { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
        .frete-opt-info { flex: 1; min-width: 0; }
        .frete-opt-nome { font-size: 14px; font-weight: 700; color: #1A1A1A; }
        .frete-opt-prazo { font-size: 12px; color: #777; margin-top: 2px; line-height: 1.35; }
        .frete-opt-preco { font-size: 14px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
        @media (max-width: 380px) { .frete-opt { padding: 12px; gap: 10px; } .frete-opt-prazo { font-size: 11.5px; } }
        .co-steps { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: nowrap; }
        .co-step { display: flex; align-items: center; gap: 8px; }
        .co-step-num { width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .co-step-label { font-size: 13px; white-space: nowrap; }
        .co-step-conn { width: 28px; height: 1px; background: #EEE; flex-shrink: 0; }
        @media (max-width: 480px) {
          .co-steps { gap: 5px; }
          .co-step { gap: 5px; }
          .co-step-num { width: 20px; height: 20px; font-size: 11px; }
          .co-step-label { font-size: 11px; }
          .co-step-conn { width: 12px; }
        }
        @media (max-width: 360px) {
          .co-step-label { display: none; }
        }
      `}</style>

      <header style={{ background: 'white', borderBottom: '1px solid #EEE', padding: '14px 18px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Link href="/carrinho" style={{ fontSize: 13, color: '#555', textDecoration: 'none', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
            ← Voltar
          </Link>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: -0.3, textAlign: 'center', lineHeight: 1.1, flex: 1, minWidth: 0 }}>
            {brand.nome}
          </div>
          <div style={{ width: 56, flexShrink: 0 }} />
        </div>
      </header>

      {/* Indicador de progreso */}
      <div style={{ background: 'white', borderBottom: '1px solid #EEE', padding: '16px 18px' }}>
        <div className="co-steps" style={{ maxWidth: 1100, margin: '0 auto' }}>
          {passos.map((p, i) => {
            const ativo = i <= 1
            return (
              <div key={p} className="co-step">
                <div className="co-step">
                  <div
                    className="co-step-num"
                    style={{
                      background: ativo ? '#1A1A1A' : '#EEE',
                      color: ativo ? 'white' : '#999',
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    className="co-step-label"
                    style={{ fontWeight: ativo ? 600 : 500, color: ativo ? '#1A1A1A' : '#999' }}
                  >
                    {p}
                  </span>
                </div>
                {i < passos.length - 1 && <div className="co-step-conn" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="checkout-wrap">
        <div className="checkout-grid">
          {/* Formulário */}
          <div>
            {/* A) Dados pessoais */}
            <div className="checkout-card">
              <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 20 }}>
                Dados pessoais
              </h2>
              <Campo
                label="Nome completo"
                value={nome}
                onChange={setNome}
                onBlur={() => marcarTocado('nome')}
                erro={err('nome')}
                placeholder="Maria da Silva"
                autoComplete="name"
              />
              <Campo
                label="E-mail"
                value={email}
                onChange={setEmail}
                onBlur={() => marcarTocado('email')}
                erro={err('email')}
                placeholder="maria@email.com"
                type="email"
                inputMode="email"
                autoComplete="email"
              />
              <div className="checkout-2col">
                <Campo
                  label="CPF"
                  value={cpf}
                  onChange={v => setCpf(maskCPF(v))}
                  onBlur={() => marcarTocado('cpf')}
                  erro={err('cpf')}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                <Campo
                  label="Telefone / WhatsApp"
                  value={telefone}
                  onChange={v => setTelefone(maskTelefone(v))}
                  onBlur={() => marcarTocado('telefone')}
                  erro={err('telefone')}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* B) Endereço de entrega */}
            <div className="checkout-card">
              <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 20 }}>
                Endereço de entrega
              </h2>

              <Campo
                label="CEP"
                value={cep}
                onChange={v => setCep(maskCEP(v))}
                onBlur={() => marcarTocado('cep')}
                erro={err('cep')}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
              />
              {cepLoading && (
                <div style={{ fontSize: 12, color: '#777', marginTop: -10, marginBottom: 16 }}>
                  Buscando endereço...
                </div>
              )}
              {cepErro && (
                <div style={{ fontSize: 12, color: '#DC2626', marginTop: -10, marginBottom: 16 }}>
                  {cepErro}
                </div>
              )}

              <Campo
                label="Rua"
                value={rua}
                onChange={setRua}
                onBlur={() => marcarTocado('rua')}
                erro={err('rua')}
                placeholder="Rua das Flores"
                autoComplete="address-line1"
              />
              <div className="checkout-2col">
                <Campo
                  label="Número"
                  value={numero}
                  onChange={setNumero}
                  onBlur={() => marcarTocado('numero')}
                  erro={err('numero')}
                  placeholder="123"
                  inputMode="numeric"
                />
                <Campo
                  label="Complemento (opcional)"
                  value={complemento}
                  onChange={setComplemento}
                  placeholder="Apt 101"
                />
              </div>
              <Campo
                label="Bairro"
                value={bairro}
                onChange={setBairro}
                onBlur={() => marcarTocado('bairro')}
                erro={err('bairro')}
                placeholder="Centro"
                autoComplete="address-level3"
              />
              <div className="checkout-2col">
                <Campo
                  label="Cidade"
                  value={cidade}
                  onChange={setCidade}
                  onBlur={() => marcarTocado('cidade')}
                  erro={err('cidade')}
                  placeholder="São Paulo"
                  autoComplete="address-level2"
                />
                <Campo
                  label="UF"
                  value={uf}
                  onChange={v => setUf(v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
                  onBlur={() => marcarTocado('uf')}
                  erro={err('uf')}
                  placeholder="SP"
                  maxLength={2}
                  autoComplete="address-level1"
                />
              </div>

              {/* Observação opcional pra revendedora (presente, embalagem etc) */}
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1D1D1D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .3 }}>
                  💬 Observação (opcional)
                </label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value.slice(0, 500))}
                  placeholder="Ex: É um presente, embala com carinho. Ou alguma dúvida pra revendedora..."
                  rows={3}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '1px solid #E5E5E5', borderRadius: 10,
                    fontSize: 14, fontFamily: 'inherit',
                    resize: 'vertical', minHeight: 80,
                    background: 'white', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 4 }}>
                  {observacoes.length}/500
                </div>
              </div>

              {/* C) Frete: opções (PAC, SEDEX) vindas de Correios PPN. Quando
                  há frete grátis aparece com prazo estimado. */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 10, letterSpacing: .3 }}>
                  Opções de envio
                </div>
                {freteLoading ? (
                  <div style={{ padding: 16, background: '#FAFAFA', borderRadius: 12, border: '1px solid #EEE', fontSize: 13, color: '#777' }}>
                    Calculando frete...
                  </div>
                ) : freteResp && freteResp.opcoes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {freteResp.opcoes.map(op => {
                      const sel = servicoEscolhido === op.servico
                      const nome = NOMES_SERVICO[op.servico]
                      return (
                        <label
                          key={op.servico}
                          className="frete-opt"
                          style={{
                            border: `1.5px solid ${sel ? corLoja : '#EEE'}`,
                            background: sel ? `${corLoja}0d` : '#FAFAFA',
                          }}
                        >
                          <input
                            type="radio"
                            name="frete-servico"
                            value={op.servico}
                            checked={sel}
                            onChange={() => setServicoEscolhido(op.servico)}
                            style={{ accentColor: corLoja, width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
                          />
                          <div className="frete-opt-info">
                            <div className="frete-opt-nome">{nome}</div>
                            <div className="frete-opt-prazo">
                              Entrega em {op.prazo_dias_min}-{op.prazo_dias_max} dias úteis
                            </div>
                          </div>
                          <div className="frete-opt-preco" style={{ color: op.gratis ? '#15803D' : '#1A1A1A' }}>
                            {op.gratis ? 'Grátis' : formatBRL(op.valor)}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 16, background: '#FAFAFA', borderRadius: 12, border: '1px solid #EEE', fontSize: 13, color: '#999' }}>
                    Preencha o CEP e a UF para calcular o frete.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* D) Resumo do pedido */}
          <div className="checkout-resumo">
            <div className="checkout-card">
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>
                Resumo do pedido
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {itensCheckout.map(item => (
                  <div key={chaveItem(item)} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, flexShrink: 0, background: '#F5F5F5', borderRadius: 8, overflow: 'hidden' }}>
                      {item.foto ? (
                        <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💎</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.nome}
                      </div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        Qtd: {item.quantidade}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                      {formatBRL(item.preco * item.quantidade)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #EEE', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555', marginBottom: 8 }}>
                  <span>Subtotal ({totalItens} {totalItens === 1 ? 'item' : 'itens'})</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555', marginBottom: 16 }}>
                  <span>Frete{opcaoSelecionada && opcaoSelecionada.servico !== 'PADRAO' ? ` (${NOMES_SERVICO[opcaoSelecionada.servico]})` : ''}</span>
                  {freteLoading ? (
                    <span style={{ color: '#999' }}>Calculando...</span>
                  ) : opcaoSelecionada ? (
                    opcaoSelecionada.gratis ? (
                      <span style={{ color: '#15803D', fontWeight: 700 }}>Grátis</span>
                    ) : (
                      <span>{formatBRL(opcaoSelecionada.valor)}</span>
                    )
                  ) : (
                    <span style={{ color: '#999' }}>—</span>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #EEE', paddingTop: 16, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Total</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#1A1A1A' }}>{formatBRL(total)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#777', marginBottom: 20, textAlign: 'right' }}>
                  ou 6x de {formatBRL(total / 6)} sem juros
                </div>

                {erroEnvio && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13, padding: 12, borderRadius: 12, marginBottom: 12, lineHeight: 1.5 }}>
                    {erroEnvio}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!formValido || enviando}
                  style={{
                    display: 'block', width: '100%', textAlign: 'center',
                    padding: '16px 20px', borderRadius: 12,
                    background: !formValido || enviando ? '#1A1A1A' : corLoja, color: 'white',
                    fontSize: 15, fontWeight: 600,
                    border: 'none',
                    cursor: !formValido || enviando ? 'not-allowed' : 'pointer',
                    opacity: !formValido || enviando ? 0.5 : 1,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                >
                  {enviando ? 'Processando...' : 'Continuar para pagamento'}
                </button>

                <div style={{ marginTop: 14, fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 1.6 }}>
                  Pagamento confirmado · Loja de Prata 925 · Prata 925 legítima
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
