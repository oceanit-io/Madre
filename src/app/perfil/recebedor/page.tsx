'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/dashboard/BottomNav'
import { BANCOS_BR, buscarBancos } from '@/lib/bancosBR'
import {
  maskCPF, maskCNPJ, maskDocumento, maskCEP, maskData, maskTelefoneNumero,
  validarDocumento, validarCEP, validarData, validarDDD, validarTelefone,
  validarCodigoBanco, validarAgencia, validarConta,
  faturamentoValido, FAIXAS_FATURAMENTO, TIPOS_CONTA,
} from '@/lib/recebedorValidacao'

type Rascunho = {
  tipo: 'individual' | 'company'
  nome: string
  email: string
  descricao?: string
  documento: string
  site?: string
  data_nascimento?: string
  ocupacao?: string
  nome_mae?: string
  faturamento_id?: string
  tipo_telefone?: 'mobile' | 'home' | 'work'
  telefone_ddd?: string
  telefone_numero?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  referencia?: string
  banco?: string
  agencia?: string
  agencia_digito?: string
  conta?: string
  conta_digito?: string
  tipo_conta?: string
  titular_nome?: string
  titular_tipo?: 'individual' | 'company'
  titular_documento?: string
}

const STATUS_META: Record<string, { label: string; bg: string; color: string; descricao: string }> = {
  draft:        { label: 'Em rascunho',   bg: '#FFF7ED', color: '#C2410C', descricao: 'Você começou mas ainda não enviou.' },
  pending:      { label: 'Em análise',    bg: '#FEF3C7', color: '#92400E', descricao: 'Enviado ao Pagar.me, aguardando aprovação.' },
  active:       { label: 'Ativo ✓',       bg: '#DCFCE7', color: '#15803D', descricao: 'Aprovado! Você já recebe split direto na sua conta.' },
  refused:      { label: 'Recusado',      bg: '#FEE2E2', color: '#B91C1C', descricao: 'O Pagar.me recusou. Confira seus dados e tente de novo.' },
  registration: { label: 'Docs pendentes', bg: '#FEF3C7', color: '#92400E', descricao: 'Pagar.me pediu docs adicionais. Veja o e-mail.' },
}

export default function RecebedorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [passo, setPasso] = useState<1 | 2 | 3>(1)

  // Rascunho default — campos vazios.
  const [r, setR] = useState<Rascunho>({ tipo: 'individual', nome: '', email: '', documento: '' })

  // Helper pra atualizar 1 campo
  function up<K extends keyof Rascunho>(k: K, v: Rascunho[K]) {
    setR(prev => ({ ...prev, [k]: v }))
  }

  // Token Supabase pra chamar a API.
  async function token(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Load inicial.
  useEffect(() => {
    async function load() {
      const t = await token()
      if (!t) { router.push('/auth/login'); return }
      const res = await fetch('/api/revendedora/recebedor', {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.recipient_id) setRecipientId(data.recipient_id)
        if (data.status) setStatus(data.status)
        // Merge: fallback (dados existentes da revendedora) primeiro,
        // depois rascunho por cima (sobreescreve só o que ela já editou).
        // Assim na 1ª vez já vem com nome/email/telefone/cidade/UF
        // pré-preenchidos.
        const base = data.fallback || {}
        const rascunho = data.rascunho || {}
        setR(prev => ({ ...prev, ...base, ...rascunho }))
      }
      setLoading(false)
    }
    load()
  }, [router])

  // Lookup CEP → preenche endereço.
  useEffect(() => {
    const cep = (r.cep || '').replace(/\D/g, '')
    if (cep.length !== 8) return
    let cancel = false
    fetch(`/api/cep/${cep}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancel || !data) return
        setR(prev => ({
          ...prev,
          logradouro: prev.logradouro || data.logradouro || '',
          bairro: prev.bairro || data.bairro || '',
          cidade: prev.cidade || data.localidade || '',
          uf: prev.uf || (data.uf || '').toUpperCase().slice(0, 2),
        }))
      })
      .catch(() => {})
    return () => { cancel = true }
  }, [r.cep])

  // Auto-save rascunho — debounce 800ms após digitar.
  useEffect(() => {
    if (loading) return
    const t = setTimeout(async () => {
      const tk = await token()
      if (!tk) return
      setSalvando(true)
      try {
        await fetch('/api/revendedora/recebedor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
          body: JSON.stringify(r),
        })
      } finally {
        setSalvando(false)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [r, loading])

  // ---------- Submit ----------
  async function submeter() {
    setErros({})
    setErroEnvio(null)
    setEnviando(true)
    try {
      const tk = await token()
      if (!tk) { router.push('/auth/login'); return }
      const res = await fetch('/api/revendedora/recebedor?submit=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify(r),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.campos) setErros(data.campos)
        setErroEnvio(data?.erro || 'Não foi possível enviar o cadastro.')
        // Volta pro passo onde tem o 1º erro pra correção.
        const ordem: Array<{ passo: 1 | 2 | 3; campos: string[] }> = [
          { passo: 1, campos: ['nome', 'email', 'documento', 'data_nascimento', 'nome_mae', 'ocupacao', 'faturamento_id', 'telefone_ddd', 'telefone_numero'] },
          { passo: 2, campos: ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'] },
          { passo: 3, campos: ['banco', 'agencia', 'conta', 'conta_digito', 'tipo_conta', 'titular_nome', 'titular_documento'] },
        ]
        if (data?.campos) {
          for (const o of ordem) {
            if (o.campos.some(c => data.campos[c])) { setPasso(o.passo); break }
          }
        }
        return
      }
      setStatus(data.status || 'pending')
      setRecipientId(data.recipient_id || null)
      setToast('Cadastro enviado ao Pagar.me! 🎉')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setEnviando(false)
    }
  }

  const meta = status ? STATUS_META[status] : null
  const trancado = status === 'active' || status === 'pending'

  // Lista de bancos filtrada pelo input do banco.
  const [bancoBusca, setBancoBusca] = useState('')
  useEffect(() => {
    const c = BANCOS_BR.find(b => b.codigo === (r.banco || ''))
    if (c && !bancoBusca) setBancoBusca(`${c.codigo} — ${c.nome}`)
  }, [r.banco, bancoBusca])
  const sugestoesBanco = useMemo(() => buscarBancos(bancoBusca, 8), [bancoBusca])
  const [bancoOpen, setBancoOpen] = useState(false)

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/perfil')} aria-label="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--cinza)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)', flex: 1 }}>Receber comissões</div>
        {salvando && <span style={{ fontSize: 11, color: 'var(--cinza)', fontStyle: 'italic' }}>Salvando…</span>}
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--cinza)' }}>Carregando...</div>
      ) : (
        <div style={{ padding: '16px 16px 20px' }}>
          {/* Status badge se houver */}
          {meta && (
            <div className="card" style={{ marginBottom: 14, padding: 14 }}>
              <div style={{ display: 'inline-block', background: meta.bg, color: meta.color, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                {meta.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.5 }}>{meta.descricao}</div>
            </div>
          )}

          {/* Stepper */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[1, 2, 3].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPasso(p as 1 | 2 | 3)}
                style={{
                  flex: 1, padding: '10px 6px', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 700, borderRadius: 12, transition: 'background .15s, color .15s',
                  background: passo === p ? 'var(--rosa)' : 'white',
                  color: passo === p ? 'white' : 'var(--cinza)',
                  border: passo === p ? 'none' : '1px solid var(--cinza-light)',
                }}
              >
                {p}. {p === 1 ? 'Identificação' : p === 2 ? 'Endereço' : 'Conta'}
              </button>
            ))}
          </div>

          {/* ============ PASSO 1: IDENTIFICAÇÃO ============ */}
          {passo === 1 && (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <Label>Tipo de recebedor</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'individual', label: 'Pessoa Física' },
                  { id: 'company',    label: 'Pessoa Jurídica' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={trancado}
                    onClick={() => up('tipo', t.id as 'individual' | 'company')}
                    style={{
                      padding: '12px 8px', borderRadius: 12, cursor: trancado ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all .15s',
                      background: r.tipo === t.id ? 'var(--rosa-pale)' : 'white',
                      border: r.tipo === t.id ? '2px solid var(--rosa)' : '1.5px solid var(--cinza-light)',
                      color: r.tipo === t.id ? 'var(--rosa-dark)' : 'var(--texto)',
                      opacity: trancado ? .6 : 1,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <Campo
                label={r.tipo === 'company' ? 'Razão social' : 'Nome completo'}
                hint={r.tipo === 'company' ? 'Como aparece no contrato social.' : 'Igual ao seu RG/CPF.'}
                valor={r.nome} onChange={v => up('nome', v)} erro={erros.nome} disabled={trancado}
              />
              <Campo
                label="E-mail"
                hint="Será usado pelo Pagar.me para te avisar sobre o cadastro."
                valor={r.email} onChange={v => up('email', v.toLowerCase())} erro={erros.email} type="email" disabled={trancado}
              />
              <Campo
                label={r.tipo === 'company' ? 'CNPJ' : 'CPF'}
                hint={`Só números — a formatação aparece sozinha. ${r.tipo === 'company' ? '14 dígitos.' : '11 dígitos.'}`}
                valor={r.tipo === 'company' ? maskCNPJ(r.documento) : maskCPF(r.documento)}
                onChange={v => up('documento', v.replace(/\D/g, ''))}
                erro={erros.documento}
                inputMode="numeric"
                disabled={trancado}
              />
              {r.tipo === 'individual' && (
                <>
                  <Campo
                    label="Data de nascimento"
                    hint="Formato DD/MM/AAAA (ex: 21/10/1990). Precisa ter mais de 18 anos."
                    valor={maskData(r.data_nascimento || '')} onChange={v => up('data_nascimento', v)} erro={erros.data_nascimento} inputMode="numeric" disabled={trancado}
                  />
                  <Campo
                    label="Nome da mãe"
                    hint="Nome completo da sua mãe, igual ao do RG. Usado pra verificação de identidade."
                    valor={r.nome_mae || ''} onChange={v => up('nome_mae', v)} erro={erros.nome_mae} disabled={trancado}
                  />
                </>
              )}
              <Campo
                label="Profissão / área de atuação"
                hint="O que você faz como atividade principal."
                valor={r.ocupacao || ''} onChange={v => up('ocupacao', v)} erro={erros.ocupacao} placeholder="Ex: Revendedora de joias" disabled={trancado}
              />

              <Label>Faturamento mensal estimado</Label>
              <select
                value={r.faturamento_id || ''}
                onChange={e => up('faturamento_id', e.target.value)}
                disabled={trancado}
                style={{ ...inputStyle, marginBottom: erros.faturamento_id ? 4 : 14 }}
              >
                <option value="">Selecione…</option>
                {FAIXAS_FATURAMENTO.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              {erros.faturamento_id && <ErroLabel>{erros.faturamento_id}</ErroLabel>}

              <Label>Telefone (com DDD)</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, marginBottom: erros.telefone_ddd || erros.telefone_numero ? 4 : 14 }}>
                <input
                  type="tel" inputMode="numeric" placeholder="DDD" maxLength={2}
                  value={r.telefone_ddd || ''}
                  onChange={e => up('telefone_ddd', e.target.value.replace(/\D/g, '').slice(0, 2))}
                  disabled={trancado}
                  style={inputStyle}
                />
                <input
                  type="tel" inputMode="numeric" placeholder="99999-9999"
                  value={maskTelefoneNumero(r.telefone_numero || '')}
                  onChange={e => up('telefone_numero', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  disabled={trancado}
                  style={inputStyle}
                />
              </div>
              {(erros.telefone_ddd || erros.telefone_numero) && (
                <ErroLabel>{erros.telefone_ddd || erros.telefone_numero}</ErroLabel>
              )}

              <Campo label="Site (opcional)" valor={r.site || ''} onChange={v => up('site', v)} placeholder="https://…" disabled={trancado} />

              <BotoesPasso
                proxima="Avançar para Endereço →"
                onProxima={() => setPasso(2)}
              />
            </div>
          )}

          {/* ============ PASSO 2: ENDEREÇO ============ */}
          {passo === 2 && (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <Campo label="CEP" valor={maskCEP(r.cep || '')} onChange={v => up('cep', v.replace(/\D/g, ''))} erro={erros.cep} inputMode="numeric" placeholder="00000-000" disabled={trancado} />
              <Campo label="Logradouro (rua, av…)" valor={r.logradouro || ''} onChange={v => up('logradouro', v)} erro={erros.logradouro} disabled={trancado} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <Campo label="Número" valor={r.numero || ''} onChange={v => up('numero', v)} erro={erros.numero} disabled={trancado} />
                </div>
                <div>
                  <Campo label="Complemento" valor={r.complemento || ''} onChange={v => up('complemento', v)} disabled={trancado} />
                </div>
              </div>
              <Campo label="Bairro" valor={r.bairro || ''} onChange={v => up('bairro', v)} erro={erros.bairro} disabled={trancado} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                <div>
                  <Campo label="Cidade" valor={r.cidade || ''} onChange={v => up('cidade', v)} erro={erros.cidade} disabled={trancado} />
                </div>
                <div>
                  <Campo label="UF" valor={r.uf || ''} onChange={v => up('uf', v.toUpperCase().slice(0, 2))} erro={erros.uf} disabled={trancado} maxLength={2} />
                </div>
              </div>
              <Campo label="Ponto de referência (opcional)" valor={r.referencia || ''} onChange={v => up('referencia', v)} disabled={trancado} />

              <BotoesPasso
                anterior="← Voltar"
                onAnterior={() => setPasso(1)}
                proxima="Avançar para Conta →"
                onProxima={() => setPasso(3)}
              />
            </div>
          )}

          {/* ============ PASSO 3: CONTA BANCÁRIA ============ */}
          {passo === 3 && (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              {/* Banco com autocomplete */}
              <Label>Banco</Label>
              <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: -3, marginBottom: 6, lineHeight: 1.35 }}>
                Digite o nome (\"Itaú\", \"Nubank\") ou o código de 3 dígitos. Selecione na lista que aparecer.
              </div>
              <div style={{ position: 'relative', marginBottom: erros.banco ? 4 : 14 }}>
                <input
                  type="text" placeholder="Digite o nome ou código"
                  value={bancoBusca}
                  onChange={e => { setBancoBusca(e.target.value); setBancoOpen(true) }}
                  onFocus={() => setBancoOpen(true)}
                  disabled={trancado}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
                {bancoOpen && !trancado && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid var(--cinza-light)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.10)', maxHeight: 240, overflowY: 'auto', zIndex: 50 }}>
                    {sugestoesBanco.map(b => (
                      <button
                        key={b.codigo}
                        type="button"
                        onClick={() => {
                          up('banco', b.codigo)
                          setBancoBusca(`${b.codigo} — ${b.nome}`)
                          setBancoOpen(false)
                        }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--texto)' }}
                      >
                        <b>{b.codigo}</b> — {b.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {erros.banco && <ErroLabel>{erros.banco}</ErroLabel>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                <div>
                  <Campo label="Agência" valor={r.agencia || ''} onChange={v => up('agencia', v.replace(/\D/g, ''))} erro={erros.agencia} inputMode="numeric" disabled={trancado} />
                </div>
                <div>
                  <Campo label="Dígito" valor={r.agencia_digito || ''} onChange={v => up('agencia_digito', v.replace(/\D/g, '').slice(0, 2))} placeholder="—" inputMode="numeric" disabled={trancado} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                <div>
                  <Campo label="Conta" valor={r.conta || ''} onChange={v => up('conta', v.replace(/\D/g, ''))} erro={erros.conta} inputMode="numeric" disabled={trancado} />
                </div>
                <div>
                  <Campo label="Dígito" valor={r.conta_digito || ''} onChange={v => up('conta_digito', v.replace(/\D/g, '').slice(0, 2))} erro={erros.conta_digito} inputMode="numeric" disabled={trancado} />
                </div>
              </div>

              <Label>Tipo de conta</Label>
              <select
                value={r.tipo_conta || ''}
                onChange={e => up('tipo_conta', e.target.value)}
                disabled={trancado}
                style={{ ...inputStyle, marginBottom: erros.tipo_conta ? 4 : 14 }}
              >
                <option value="">Selecione…</option>
                {TIPOS_CONTA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {erros.tipo_conta && <ErroLabel>{erros.tipo_conta}</ErroLabel>}

              <Campo
                label="Nome do titular da conta"
                hint="Como aparece no banco. Pagar.me limita a 30 caracteres — se o seu nome for maior, encurta (ex: 'Maria Silva' em vez de 'Maria da Silva Santos')."
                valor={r.titular_nome || ''} onChange={v => up('titular_nome', v.slice(0, 30))} erro={erros.titular_nome} disabled={trancado}
                maxLength={30} mostrarContador
              />

              <Label>Tipo do titular</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'individual', label: 'Pessoa Física' },
                  { id: 'company',    label: 'Pessoa Jurídica' },
                ].map(t => (
                  <button
                    key={t.id} type="button"
                    onClick={() => up('titular_tipo', t.id as 'individual' | 'company')}
                    disabled={trancado}
                    style={{
                      padding: '10px 8px', borderRadius: 12, cursor: trancado ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                      background: (r.titular_tipo || 'individual') === t.id ? 'var(--rosa-pale)' : 'white',
                      border: (r.titular_tipo || 'individual') === t.id ? '2px solid var(--rosa)' : '1.5px solid var(--cinza-light)',
                      color: (r.titular_tipo || 'individual') === t.id ? 'var(--rosa-dark)' : 'var(--texto)',
                      opacity: trancado ? .6 : 1,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <Campo
                label={`Documento do titular (${(r.titular_tipo || 'individual') === 'company' ? 'CNPJ' : 'CPF'})`}
                valor={maskDocumento(r.titular_documento || '')}
                onChange={v => up('titular_documento', v.replace(/\D/g, ''))}
                erro={erros.titular_documento}
                inputMode="numeric"
                disabled={trancado}
              />

              {erroEnvio && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12.5, color: '#B91C1C', lineHeight: 1.5 }}>
                  {erroEnvio}
                </div>
              )}

              <BotoesPasso
                anterior="← Voltar"
                onAnterior={() => setPasso(2)}
                final={trancado ? 'Cadastro enviado ✓' : (enviando ? 'Enviando…' : (recipientId ? '↺ Reenviar atualização' : '🚀 Enviar para o Pagar.me'))}
                onFinal={trancado ? undefined : submeter}
                desabilitarFinal={enviando || trancado}
              />
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--cinza)', padding: '8px 16px 0', lineHeight: 1.5 }}>
            Seus dados são salvos automaticamente. Você pode sair e voltar a qualquer momento.
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: '#15803D', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1100, boxShadow: '0 8px 24px rgba(21,128,61,.3)' }}>
          {toast}
        </div>
      )}

      <BottomNav ativa="perfil" />
    </div>
  )
}

// ============ Componentes auxiliares ============

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid var(--cinza-light)', fontSize: 14,
  fontFamily: 'inherit', color: 'var(--texto)',
  background: 'white', outline: 'none', boxSizing: 'border-box',
  marginBottom: 14,
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--texto)', marginBottom: 6 }}>{children}</label>
}

function ErroLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: '#DC2626', marginBottom: 10, marginTop: -2 }}>{children}</div>
}

function Campo({ label, valor, onChange, erro, hint, type = 'text', inputMode, placeholder, disabled, maxLength, mostrarContador }: {
  label: string; valor: string; onChange: (v: string) => void;
  erro?: string; hint?: string;
  type?: string; inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  placeholder?: string; disabled?: boolean; maxLength?: number;
  mostrarContador?: boolean;
}) {
  const len = (valor || '').length
  const proxLimite = maxLength && len >= maxLength - 5
  return (
    <>
      <Label>{label}</Label>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: -3, marginBottom: 6, lineHeight: 1.35 }}>
          {hint}
        </div>
      )}
      <input
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={valor}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        style={{
          ...inputStyle,
          marginBottom: (erro || mostrarContador) ? 4 : 14,
          borderColor: erro ? '#DC2626' : 'var(--cinza-light)',
          background: disabled ? '#F5F5F5' : 'white',
        }}
      />
      {mostrarContador && maxLength && (
        <div style={{ fontSize: 10.5, color: proxLimite ? '#C2410C' : 'var(--cinza)', textAlign: 'right', marginBottom: erro ? 4 : 12 }}>
          {len}/{maxLength}
        </div>
      )}
      {erro && <ErroLabel>{erro}</ErroLabel>}
    </>
  )
}

function BotoesPasso({ anterior, onAnterior, proxima, onProxima, final, onFinal, desabilitarFinal }: {
  anterior?: string; onAnterior?: () => void;
  proxima?: string; onProxima?: () => void;
  final?: string; onFinal?: () => void;
  desabilitarFinal?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      {anterior && (
        <button
          type="button" onClick={onAnterior}
          style={{ flex: 1, padding: 14, borderRadius: 12, background: 'white', border: '1.5px solid var(--cinza-light)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cinza)' }}
        >
          {anterior}
        </button>
      )}
      {proxima && (
        <button
          type="button" onClick={onProxima}
          className="btn-rosa"
          style={{ flex: 2 }}
        >
          {proxima}
        </button>
      )}
      {final && (
        <button
          type="button" onClick={onFinal} disabled={desabilitarFinal || !onFinal}
          className="btn-rosa"
          style={{ flex: 2, opacity: (desabilitarFinal || !onFinal) ? .6 : 1, cursor: (desabilitarFinal || !onFinal) ? 'not-allowed' : 'pointer' }}
        >
          {final}
        </button>
      )}
    </div>
  )
}
