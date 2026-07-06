'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type Revendedora } from '@/lib/supabase'
import BottomNav from '@/components/dashboard/BottomNav'
import BannerPagamentoPendente from '@/components/dashboard/BannerPagamentoPendente'
import { LogoP15 } from '@/components/LogoP15'

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

function mascaraWhats(s: string): string {
  const d = (s || '').replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function PerfilPage() {
  const router = useRouter()
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  const [loading, setLoading] = useState(true)
  const [saindo, setSaindo] = useState(false)

  // Modo edição
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const [form, setForm] = useState({ nome: '', whatsapp: '', cidade: '', estado: '' })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rev } = await supabase.from('revendedoras').select('*').eq('user_id', user.id).single()
      if (!rev) return
      setRevendedora(rev)
      setForm({
        nome: rev.nome || '',
        whatsapp: mascaraWhats(rev.whatsapp || ''),
        cidade: rev.cidade || '',
        estado: rev.estado || '',
      })
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function flash(msg: string, tipo: 'ok' | 'erro') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function salvar() {
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { flash('Sessão expirou. Faz login de novo.', 'erro'); setSalvando(false); return }

      const res = await fetch('/api/revendedora/perfil', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          whatsapp: form.whatsapp.replace(/\D/g, ''),
          cidade: form.cidade.trim(),
          estado: form.estado.trim().toUpperCase(),
        }),
      })
      const d = await res.json()
      if (!res.ok) { flash(d?.erro || 'Erro ao salvar', 'erro'); setSalvando(false); return }

      // Atualiza state local com retorno do server
      setRevendedora(prev => prev ? { ...prev, ...d } : prev)
      setForm(prev => ({ ...prev, whatsapp: mascaraWhats(d.whatsapp) }))
      setEditando(false)
      flash('Perfil atualizado! ✨', 'ok')
    } catch {
      flash('Erro de conexão', 'erro')
    }
    setSalvando(false)
  }

  function cancelar() {
    if (!revendedora) return
    setForm({
      nome: revendedora.nome || '',
      whatsapp: mascaraWhats(revendedora.whatsapp || ''),
      cidade: revendedora.cidade || '',
      estado: revendedora.estado || '',
    })
    setEditando(false)
  }

  async function sair() {
    setSaindo(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
      <div style={{ fontSize: 13, color: 'var(--cinza)' }}>Carregando...</div>
    </div>
  )

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>

      <BannerPagamentoPendente status={revendedora?.status} />

      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)' }}>Meu perfil</div>
      </header>

      {/* Avatar + nome */}
      <div style={{ background: 'var(--rosa-pale)', padding: '32px 20px', textAlign: 'center', borderBottom: '1px solid var(--rosa-border)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--rosa)', border: '3px solid var(--rosa-border)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat', fontSize: 32, fontWeight: 900, color: 'white' }}>
          {revendedora?.nome?.[0]?.toUpperCase()}
        </div>
        <div style={{ fontFamily: 'Montserrat', fontSize: 20, fontWeight: 900, color: 'var(--texto)', marginBottom: 4 }}>
          {revendedora?.nome}
        </div>
        <div style={{ fontSize: 13, color: 'var(--cinza)', marginBottom: 8 }}>
          {revendedora?.email}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: revendedora?.status === 'ativa' ? '#E1F5EE' : 'var(--rosa-mist)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: revendedora?.status === 'ativa' ? '#1ba78a' : 'var(--rosa)' }}>
          {revendedora?.status === 'ativa' ? '✅ Revendedora ativa' : '⏳ Aprovação pendente'}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Conta bancária (recebedor Pagar.me). Sempre acessível pra ativas:
            "Cadastrar" se ainda não enviou, "Alterar" pra trocar a conta. */}
        {revendedora?.status === 'ativa' && (
          <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 2 }}>
                💳 Conta bancária
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.4 }}>
                {revendedora?.pagarme_recipient_id
                  ? 'Vinculada. Suas comissões caem direto nela.'
                  : 'Cadastre pra receber suas comissões direto na sua conta.'}
              </div>
            </div>
            <button
              onClick={() => router.push('/perfil/recebedor')}
              style={{ flexShrink: 0, background: '#0ABAB5', color: '#fff', border: 'none', borderRadius: 24, padding: '9px 16px', cursor: 'pointer', fontFamily: 'Montserrat', fontSize: 12, fontWeight: 800, boxShadow: '0 6px 16px rgba(10,186,181,.32)' }}
            >
              {revendedora?.pagarme_recipient_id ? 'Alterar' : 'Cadastrar'}
            </button>
          </div>
        )}

        {/* Dados — editáveis */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)' }}>
              📋 Seus dados
            </div>
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                style={{ background: 'transparent', border: '1px solid var(--rosa)', color: 'var(--rosa)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                ✏️ Editar
              </button>
            )}
          </div>

          {!editando ? (
            <>
              {[
                { label: 'Nome', val: revendedora?.nome },
                { label: 'E-mail', val: revendedora?.email },
                { label: 'WhatsApp', val: revendedora?.whatsapp ? mascaraWhats(revendedora.whatsapp) : '—' },
                { label: 'Cidade / Estado', val: revendedora?.cidade ? `${revendedora.cidade}, ${revendedora.estado}` : '—' },
                { label: 'Membro desde', val: formatDate(revendedora?.criado_em || '') },
              ].map((d, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--cinza-light)' : 'none' }}>
                  <div style={{ fontSize: 12, color: 'var(--cinza)' }}>{d.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--texto)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{d.val}</div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 10, lineHeight: 1.4 }}>
                💡 Pra trocar o e-mail, fala com o suporte. Os outros campos tu edita aqui mesmo.
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Nome completo</label>
                <input
                  className="input-padrao"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value.slice(0, 80) })}
                  placeholder="Maria Silva"
                  maxLength={80}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>WhatsApp</label>
                <input
                  className="input-padrao"
                  value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: mascaraWhats(e.target.value) })}
                  placeholder="(11) 98765-4321"
                  inputMode="tel"
                />
                <div style={{ fontSize: 10, color: 'var(--cinza)', marginTop: 4 }}>
                  Como suas clientes vão te chamar
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Cidade</label>
                  <input
                    className="input-padrao"
                    value={form.cidade}
                    onChange={e => setForm({ ...form, cidade: e.target.value.slice(0, 60) })}
                    placeholder="São Paulo"
                    maxLength={60}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>UF</label>
                  <select
                    className="input-padrao"
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: e.target.value })}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="">--</option>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={cancelar}
                  disabled={salvando}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--cinza-light)', color: 'var(--cinza)', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  style={{ flex: 1, background: 'var(--rosa)', color: 'white', border: 'none', padding: 12, borderRadius: 10, fontSize: 13, fontFamily: 'Montserrat', fontWeight: 700, cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? .7 : 1 }}
                >
                  {salvando ? 'Salvando…' : '💾 Salvar'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* URL da loja — info adicional, edição vai pra configurar-loja */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🔗 Tua loja</div>
              <div style={{ fontSize: 11, color: 'var(--cinza)', marginBottom: 4, fontFamily: 'monospace' }}>
                lojadeprata925.com.br/loja/{revendedora?.subdominio}
              </div>
            </div>
            <button
              onClick={() => router.push('/configurar-loja')}
              style={{ background: 'transparent', border: '1px solid var(--rosa)', color: 'var(--rosa)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🎨 Personalizar
            </button>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 14 }}>
            💰 Resumo financeiro
          </div>
          {[
            { label: 'Total de vendas', val: revendedora?.total_vendas?.toString() || '0' },
            { label: 'Total ganho', val: formatBRL(revendedora?.total_ganho || 0) },
            { label: 'Saldo disponível', val: formatBRL(revendedora?.saldo_disponivel || 0) },
          ].map((d, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--cinza-light)' : 'none' }}>
              <div style={{ fontSize: 12, color: 'var(--cinza)' }}>{d.label}</div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--teal-dark)' }}>{d.val}</div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="card" style={{ marginBottom: 12 }}>
          {[
            { label: '🔐 Alterar senha', action: () => router.push('/auth/redefinir-senha') },
            { label: '🎨 Personalizar minha loja', action: () => router.push('/configurar-loja') },
            { label: '💸 Ver histórico de saques', action: () => router.push('/saldo') },
            { label: '📊 Ver todas as vendas', action: () => router.push('/vendas') },
          ].map((a, i, arr) => (
            <button key={i} onClick={a.action} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--cinza-light)' : 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--texto)', textAlign: 'left' }}>
              {a.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cinza)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* Sair */}
        <button onClick={sair} disabled={saindo} style={{ width: '100%', padding: 16, borderRadius: 14, border: '1.5px solid var(--rosa-border)', background: 'var(--rosa-pale)', color: 'var(--rosa)', fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
          {saindo ? 'Saindo...' : '🚪 Sair da conta'}
        </button>

        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <LogoP15 altura={26} centro />
        </div>

        {/* Catálogo by Prata 15 */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
            Catálogo oficial fornecido por
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/logo-p15.png"
            alt="Prata de 15 Reais"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--cinza)', padding: '8px 0 8px' }}>
          Sistema de Revendedoras · v1.0
        </div>
      </div>

      {/* Toast feedback */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: toast.tipo === 'ok' ? '#10B981' : '#DC2626',
          color: 'white', padding: '12px 20px', borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 1000,
          boxShadow: '0 4px 16px rgba(0,0,0,.18)',
          maxWidth: 'calc(100% - 32px)',
        }}>
          {toast.msg}
        </div>
      )}

      <BottomNav ativa="perfil" />
    </div>
  )
}
