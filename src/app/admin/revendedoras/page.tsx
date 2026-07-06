'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Revendedora } from '@/lib/supabase'
import AtualizarBtn from '@/components/admin/AtualizarBtn'

export default function AdminRevendedorasPage() {
  const router = useRouter()
  const [revendedoras, setRevendedoras] = useState<Revendedora[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'pendente' | 'suspensa'>('todas')
  const [recuperando, setRecuperando] = useState<string | null>(null)
  const [definindo, setDefinindo] = useState<string | null>(null)
  // Viewer (somente leitura): esconde os botões de ação. O bloqueio real é
  // server-side (middleware), isto é só UX.
  const [somenteLeitura, setSomenteLeitura] = useState(false)
  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setSomenteLeitura(d?.role === 'viewer'))
      .catch(() => {})
  }, [])
  // Guard de UX: bloqueia a ação no client se for viewer (o middleware já
  // bloqueia no server, isto evita o request e dá feedback claro).
  function bloqueadoSeLeitura(): boolean {
    if (!somenteLeitura) return false
    setToast({ msg: 'Acesso somente leitura: ação bloqueada', tipo: 'erro' })
    setTimeout(() => setToast(null), 3000)
    return true
  }
  const [corrigindoEmail, setCorrigindoEmail] = useState<string | null>(null)
  const [corrigindoUrl, setCorrigindoUrl] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  async function excluirRevendedora(revendedora_id: string, nome: string, email: string) {
    if (bloqueadoSeLeitura()) return
    const aviso = `⚠️ EXCLUIR PERMANENTEMENTE "${nome}"?\n\n` +
      `Email: ${email}\n\n` +
      `Isso vai apagar:\n` +
      `• Cadastro da revendedora\n` +
      `• Login (auth)\n` +
      `• Vendas, saques, notificações vinculadas\n\n` +
      `❌ NÃO PODE SER DESFEITO.\n\n` +
      `Tens certeza?`
    if (!confirm(aviso)) return

    const confirmar = window.prompt(
      `Pra confirmar a exclusão definitiva, digite o email da revendedora:\n\n${email}`,
      ''
    )
    if (!confirmar || confirmar.trim().toLowerCase() !== email.toLowerCase()) {
      if (confirmar !== null) {
        setToast({ msg: 'Email não bate. Exclusão cancelada.', tipo: 'erro' })
        setTimeout(() => setToast(null), 4000)
      }
      return
    }

    setExcluindo(revendedora_id)
    try {
      const res = await fetch('/api/admin/excluir-revendedora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revendedora_id, confirmar: confirmar.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ msg: data?.erro || 'Erro ao excluir', tipo: 'erro' })
      } else {
        setToast({ msg: `✓ ${nome} excluída permanentemente`, tipo: 'ok' })
        carregar()
      }
    } catch {
      setToast({ msg: 'Erro de conexão', tipo: 'erro' })
    }
    setExcluindo(null)
    setTimeout(() => setToast(null), 4000)
  }

  async function arquivar(revendedora_id: string, nome: string, status: string) {
    if (bloqueadoSeLeitura()) return
    if (status === 'suspensa') {
      // Reativa
      if (!confirm(`Reativar "${nome}"?\n\nVolta pro status "pendente" — ela vai precisar pagar pra ativar.`)) return
      setArquivando(revendedora_id)
      try {
        const res = await fetch('/api/admin/reativar-revendedora', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revendedora_id, para: 'pendente' }),
        })
        const data = await res.json()
        if (!res.ok) {
          setToast({ msg: data?.erro || 'Erro ao reativar', tipo: 'erro' })
        } else {
          setToast({ msg: `✓ ${nome} reativada (pendente)`, tipo: 'ok' })
          carregar()
        }
      } catch {
        setToast({ msg: 'Erro de conexão', tipo: 'erro' })
      }
      setArquivando(null)
    } else {
      // Arquiva (suspensa)
      if (!confirm(`Arquivar "${nome}"?\n\nVai pro status "suspensa" — ela some das listas ativas mas o cadastro fica preservado. Pode ser revertido depois.`)) return
      setArquivando(revendedora_id)
      try {
        const res = await fetch('/api/admin/arquivar-revendedora', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revendedora_id }),
        })
        const data = await res.json()
        if (!res.ok) {
          setToast({ msg: data?.erro || 'Erro ao arquivar', tipo: 'erro' })
        } else {
          setToast({ msg: `✓ ${nome} arquivada`, tipo: 'ok' })
          carregar()
        }
      } catch {
        setToast({ msg: 'Erro de conexão', tipo: 'erro' })
      }
      setArquivando(null)
    }
    setTimeout(() => setToast(null), 4000)
  }

  function gerarSlugSugestao(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
  }

  async function corrigirUrl(revendedora_id: string, urlAtual: string, nome: string, nomeLoja: string | null) {
    if (bloqueadoSeLeitura()) return
    const sugestao = nomeLoja ? gerarSlugSugestao(nomeLoja) : gerarSlugSugestao(nome)
    const novaUrl = prompt(
      `Trocar URL da loja de ${nome}\n\nAtual: lojadeprata925.com.br/loja/${urlAtual}\n\nDigite a nova URL (só letras, números e hífens):`,
      sugestao
    )
    if (!novaUrl || novaUrl.trim() === '' || novaUrl.trim().toLowerCase() === urlAtual?.toLowerCase()) {
      return
    }
    const slug = gerarSlugSugestao(novaUrl)
    if (!confirm(`Confirmar troca da URL?\n\nDe:  lojadeprata925.com.br/loja/${urlAtual}\nPra: lojadeprata925.com.br/loja/${slug}\n\n⚠️ Qualquer link antigo da loja vai parar de funcionar.`)) {
      return
    }
    setCorrigindoUrl(revendedora_id)
    try {
      const res = await fetch('/api/admin/corrigir-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revendedora_id, nova_url: slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ msg: data?.erro || 'Erro ao trocar URL', tipo: 'erro' })
      } else {
        setToast({ msg: `✓ URL trocada para /loja/${data.url_nova}`, tipo: 'ok' })
        carregar()
      }
    } catch {
      setToast({ msg: 'Erro de conexão', tipo: 'erro' })
    }
    setCorrigindoUrl(null)
    setTimeout(() => setToast(null), 4000)
  }
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  async function corrigirEmail(revendedora_id: string, emailAtual: string, nome: string) {
    if (bloqueadoSeLeitura()) return
    const novoEmail = prompt(
      `Corrigir e-mail de ${nome}\n\nAtual: ${emailAtual}\n\nDigite o novo e-mail:`,
      emailAtual
    )
    if (!novoEmail || novoEmail.trim() === '' || novoEmail.trim().toLowerCase() === emailAtual.toLowerCase()) {
      return
    }
    if (!confirm(`Confirmar troca do e-mail de "${emailAtual}" para "${novoEmail}"?\n\nIsso atualiza o login dela e a tabela revendedoras.`)) {
      return
    }
    setCorrigindoEmail(revendedora_id)
    try {
      const res = await fetch('/api/admin/corrigir-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revendedora_id, novo_email: novoEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ msg: data?.erro || 'Erro ao corrigir', tipo: 'erro' })
      } else {
        setToast({ msg: `✓ E-mail trocado para ${data.email_novo}`, tipo: 'ok' })
        carregar()
      }
    } catch {
      setToast({ msg: 'Erro de conexão', tipo: 'erro' })
    }
    setCorrigindoEmail(null)
    setTimeout(() => setToast(null), 4000)
  }

  async function recuperarSenha(email: string, nome: string) {
    if (bloqueadoSeLeitura()) return
    if (!confirm(`Enviar e-mail de recuperação de senha para ${nome} (${email})?`)) return
    setRecuperando(email)
    try {
      const res = await fetch('/api/admin/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ msg: data?.erro || 'Erro ao enviar', tipo: 'erro' })
      } else {
        setToast({ msg: `✉️ E-mail enviado para ${email}`, tipo: 'ok' })
      }
    } catch {
      setToast({ msg: 'Erro de conexão', tipo: 'erro' })
    }
    setRecuperando(null)
    setTimeout(() => setToast(null), 3500)
  }

  // Define direto uma nova senha (sem e-mail). A revendedora passa a logar
  // com ela imediatamente.
  async function definirSenha(revendedora_id: string, nome: string) {
    if (bloqueadoSeLeitura()) return
    const nova = prompt(`Definir nova senha para ${nome} (mínimo 6 caracteres):`)
    if (nova === null) return
    const senha = nova.trim()
    if (senha.length < 6) {
      setToast({ msg: 'A senha precisa ter ao menos 6 caracteres', tipo: 'erro' })
      setTimeout(() => setToast(null), 3500)
      return
    }
    if (!confirm(`Confirmar nova senha de ${nome}?\nEla vai logar com: ${senha}`)) return
    setDefinindo(revendedora_id)
    try {
      const res = await fetch('/api/admin/definir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revendedora_id, nova_senha: senha }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ msg: data?.erro || 'Erro ao definir senha', tipo: 'erro' })
      } else {
        setToast({ msg: `🔑 Senha definida para ${nome}`, tipo: 'ok' })
      }
    } catch {
      setToast({ msg: 'Erro de conexão', tipo: 'erro' })
    }
    setDefinindo(null)
    setTimeout(() => setToast(null), 4000)
  }

  async function carregar() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/revendedoras', {
        headers: {},
        cache: 'no-store',
      })
      if (!res.ok) {
        setRevendedoras([])
      } else {
        const data = await res.json()
        setRevendedoras(data || [])
      }
    } catch (e) {
      console.error('Erro ao carregar revendedoras:', e)
      setRevendedoras([])
    } finally {
      setLoading(false)
      setRefreshing(false)
      setUltimaAtualizacao(Date.now())
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'ok') {
      router.replace('/admin')
      return
    }
    carregar()
  }, [])

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatData(data: string) {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  const filtradas = revendedoras.filter(r => {
    const matchBusca =
      busca === '' ||
      r.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      r.email?.toLowerCase().includes(busca.toLowerCase()) ||
      r.nome_loja?.toLowerCase().includes(busca.toLowerCase()) ||
      r.whatsapp?.includes(busca)
    const matchStatus = filtroStatus === 'todas' || r.status === filtroStatus
    return matchBusca && matchStatus
  })

  function statusBadge(status: string) {
    const cores: Record<string, { bg: string; color: string }> = {
      ativa: { bg: '#ECFDF5', color: '#059669' },
      pendente: { bg: '#FFFBEB', color: '#D97706' },
      suspensa: { bg: '#FEE2E2', color: '#DC2626' },
    }
    const c = cores[status] || cores.pendente
    return (
      <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3, whiteSpace: 'nowrap' }}>
        {status}
      </span>
    )
  }

  return (
    <div className="rv-wrap">
      <header className="rv-top">
        <a href="/admin" className="rv-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Voltar ao backoffice
        </a>
      </header>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 100,
            background: toast.tipo === 'ok' ? '#D1FAE5' : '#FEE2E2',
            border: `1px solid ${toast.tipo === 'ok' ? '#10B981' : '#EF4444'}`,
            color: toast.tipo === 'ok' ? '#065F46' : '#991B1B',
            padding: '12px 18px', borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0,0,0,.08)',
            maxWidth: 360,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="rv-hero" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="rv-eyebrow">Gestão</div>
          <div className="rv-title">Revendedoras</div>
          <div className="rv-sub">{revendedoras.length} cadastradas · {filtradas.length} exibindo</div>
        </div>
        <AtualizarBtn
          onClick={carregar}
          loading={refreshing}
          ultimaAtualizacao={ultimaAtualizacao}
        />
      </div>

      <div className="rv-filters">
        <div className="rv-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Buscar por nome, email, loja ou whatsapp..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)} className="rv-select">
          <option value="todas">Todos os status</option>
          <option value="ativa">Ativas</option>
          <option value="pendente">Pendentes</option>
          <option value="suspensa">Suspensas</option>
        </select>
      </div>

      {loading ? (
        <div className="rv-state">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="rv-state">Nenhuma revendedora encontrada</div>
      ) : (
        <>
          <div className="rv-table-wrap">
            <table className="rv-table">
              <thead>
                <tr>
                  <th>Nome / Loja</th>
                  <th>Contato</th>
                  <th>Localização</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Vendas</th>
                  <th>Saldo</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="rv-name">{r.nome}</div>
                      <div className="rv-loja">
                        {r.nome_loja || <span className="rv-loja-empty">sem nome de loja</span>}
                      </div>
                      <div className="rv-email">{r.email}</div>
                      {r.subdominio && (
                        <div style={{ fontSize: 11, color: r.subdominio.match(/-\d{4}$/) ? '#92400E' : '#666', marginTop: 2, fontFamily: 'monospace' }}>
                          /loja/{r.subdominio}
                          {r.subdominio.match(/-\d{4}$/) && <span style={{ marginLeft: 4 }}>⚠️</span>}
                        </div>
                      )}
                    </td>
                    <td>{r.whatsapp || '—'}</td>
                    <td>{r.cidade ? `${r.cidade}, ${r.estado}` : '—'}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.total_vendas || 0}</td>
                    <td className="rv-saldo">{formatBRL(r.saldo_disponivel || 0)}</td>
                    <td className="rv-data">{formatData(r.criado_em)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          onClick={() => recuperarSenha(r.email, r.nome)}
                          disabled={recuperando === r.email}
                          title="Enviar e-mail de recuperação de senha"
                          style={{
                            background: '#F3F4F6', border: '1px solid #E5E7EB',
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600, color: '#374151',
                            cursor: recuperando === r.email ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: recuperando === r.email ? .6 : 1,
                          }}
                        >
                          {recuperando === r.email ? 'Enviando…' : '✉️ Recuperar senha'}
                        </button>
                        <button
                          onClick={() => definirSenha(r.id, r.nome)}
                          disabled={definindo === r.id}
                          title="Definir uma nova senha direto (sem e-mail)"
                          style={{
                            background: '#EEF2FF', border: '1px solid #C7D2FE',
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600, color: '#4338CA',
                            cursor: definindo === r.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: definindo === r.id ? .6 : 1,
                          }}
                        >
                          {definindo === r.id ? 'Salvando…' : '🔑 Definir senha'}
                        </button>
                        <button
                          onClick={() => corrigirEmail(r.id, r.email, r.nome)}
                          disabled={corrigindoEmail === r.id}
                          title="Corrigir e-mail (caso tenha typo, ex: .comom)"
                          style={{
                            background: '#FEF3C7', border: '1px solid #FCD34D',
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600, color: '#92400E',
                            cursor: corrigindoEmail === r.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: corrigindoEmail === r.id ? .6 : 1,
                          }}
                        >
                          {corrigindoEmail === r.id ? 'Salvando…' : '✏️ Corrigir e-mail'}
                        </button>
                        <button
                          onClick={() => corrigirUrl(r.id, r.subdominio || '', r.nome, r.nome_loja)}
                          disabled={corrigindoUrl === r.id}
                          title={`URL atual: /loja/${r.subdominio || '(sem URL)'}`}
                          style={{
                            background: '#EDE9FE', border: '1px solid #C4B5FD',
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600, color: '#5B21B6',
                            cursor: corrigindoUrl === r.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: corrigindoUrl === r.id ? .6 : 1,
                          }}
                        >
                          {corrigindoUrl === r.id ? 'Salvando…' : '🔗 Trocar URL'}
                        </button>
                        <button
                          onClick={() => arquivar(r.id, r.nome, r.status)}
                          disabled={arquivando === r.id}
                          title={r.status === 'suspensa' ? 'Reativar (volta pra pendente)' : 'Arquivar (suspende)'}
                          style={{
                            background: r.status === 'suspensa' ? '#DCFCE7' : '#FEE2E2',
                            border: `1px solid ${r.status === 'suspensa' ? '#86EFAC' : '#FCA5A5'}`,
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600,
                            color: r.status === 'suspensa' ? '#166534' : '#B91C1C',
                            cursor: arquivando === r.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: arquivando === r.id ? .6 : 1,
                          }}
                        >
                          {arquivando === r.id ? '…' : r.status === 'suspensa' ? '↩️ Reativar' : '🗄️ Arquivar'}
                        </button>
                        <button
                          onClick={() => excluirRevendedora(r.id, r.nome, r.email)}
                          disabled={excluindo === r.id}
                          title="Excluir permanentemente (irreversível)"
                          style={{
                            background: '#1F2937', border: '1px solid #111827',
                            borderRadius: 8, padding: '6px 10px',
                            fontSize: 11, fontWeight: 600, color: 'white',
                            cursor: excluindo === r.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap', opacity: excluindo === r.id ? .6 : 1,
                          }}
                        >
                          {excluindo === r.id ? '…' : '🗑️ Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rv-cards">
            {filtradas.map(r => (
              <div key={r.id} className="rv-card">
                <div className="rv-card-head">
                  <div>
                    <div className="rv-name">{r.nome}</div>
                    <div className="rv-loja">
                      {r.nome_loja || <span className="rv-loja-empty">sem nome de loja</span>}
                    </div>
                  </div>
                  {statusBadge(r.status)}
                </div>
                <div className="rv-card-info">
                  <div>{r.email}</div>
                  {r.whatsapp && <div>{r.whatsapp}</div>}
                  {r.cidade && <div>{r.cidade}, {r.estado}</div>}
                </div>
                <div className="rv-card-stats">
                  <div>
                    <div className="rv-stat-label">Vendas</div>
                    <div className="rv-stat-val">{r.total_vendas || 0}</div>
                  </div>
                  <div>
                    <div className="rv-stat-label">Saldo</div>
                    <div className="rv-stat-val rv-saldo">{formatBRL(r.saldo_disponivel || 0)}</div>
                  </div>
                  <div>
                    <div className="rv-stat-label">Cadastro</div>
                    <div className="rv-stat-val rv-data">{formatData(r.criado_em)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={() => recuperarSenha(r.email, r.nome)}
                    disabled={recuperando === r.email}
                    style={{
                      width: '100%',
                      background: '#F3F4F6', border: '1px solid #E5E7EB',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600, color: '#374151',
                      cursor: recuperando === r.email ? 'wait' : 'pointer',
                      opacity: recuperando === r.email ? .6 : 1,
                    }}
                  >
                    {recuperando === r.email ? 'Enviando…' : '✉️ Recuperar senha'}
                  </button>
                  <button
                    onClick={() => definirSenha(r.id, r.nome)}
                    disabled={definindo === r.id}
                    style={{
                      width: '100%',
                      background: '#EEF2FF', border: '1px solid #C7D2FE',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600, color: '#4338CA',
                      cursor: definindo === r.id ? 'wait' : 'pointer',
                      opacity: definindo === r.id ? .6 : 1,
                    }}
                  >
                    {definindo === r.id ? 'Salvando…' : '🔑 Definir senha'}
                  </button>
                  <button
                    onClick={() => corrigirEmail(r.id, r.email, r.nome)}
                    disabled={corrigindoEmail === r.id}
                    style={{
                      width: '100%',
                      background: '#FEF3C7', border: '1px solid #FCD34D',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600, color: '#92400E',
                      cursor: corrigindoEmail === r.id ? 'wait' : 'pointer',
                      opacity: corrigindoEmail === r.id ? .6 : 1,
                    }}
                  >
                    {corrigindoEmail === r.id ? 'Salvando…' : '✏️ Corrigir e-mail'}
                  </button>
                  <button
                    onClick={() => corrigirUrl(r.id, r.subdominio || '', r.nome, r.nome_loja)}
                    disabled={corrigindoUrl === r.id}
                    style={{
                      width: '100%',
                      background: '#EDE9FE', border: '1px solid #C4B5FD',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600, color: '#5B21B6',
                      cursor: corrigindoUrl === r.id ? 'wait' : 'pointer',
                      opacity: corrigindoUrl === r.id ? .6 : 1,
                    }}
                  >
                    {corrigindoUrl === r.id ? 'Salvando…' : '🔗 Trocar URL'}
                  </button>
                  <button
                    onClick={() => arquivar(r.id, r.nome, r.status)}
                    disabled={arquivando === r.id}
                    style={{
                      width: '100%',
                      background: r.status === 'suspensa' ? '#DCFCE7' : '#FEE2E2',
                      border: `1px solid ${r.status === 'suspensa' ? '#86EFAC' : '#FCA5A5'}`,
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600,
                      color: r.status === 'suspensa' ? '#166534' : '#B91C1C',
                      cursor: arquivando === r.id ? 'wait' : 'pointer',
                      opacity: arquivando === r.id ? .6 : 1,
                    }}
                  >
                    {arquivando === r.id ? 'Aguarde…' : r.status === 'suspensa' ? '↩️ Reativar' : '🗄️ Arquivar'}
                  </button>
                  <button
                    onClick={() => excluirRevendedora(r.id, r.nome, r.email)}
                    disabled={excluindo === r.id}
                    style={{
                      width: '100%',
                      background: '#1F2937', border: '1px solid #111827',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, fontWeight: 600, color: 'white',
                      cursor: excluindo === r.id ? 'wait' : 'pointer',
                      opacity: excluindo === r.id ? .6 : 1,
                    }}
                  >
                    {excluindo === r.id ? 'Aguarde…' : '🗑️ Excluir permanentemente'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .rv-wrap {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 40px 56px 56px;
          box-sizing: border-box;
          background: #FAFAFA;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
        }
        .rv-top {
          margin-bottom: 24px;
        }
        .rv-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #64748B;
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 6px;
          transition: all .15s;
        }
        .rv-back:hover {
          background: #F5F5F5;
          color: #1A1A1A;
        }
        .rv-hero {
          margin-bottom: 32px;
        }
        .rv-eyebrow {
          font-size: 11px;
          font-weight: 600;
          color: #E8396A;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 10px;
        }
        .rv-title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          letter-spacing: -.5px;
          margin-bottom: 6px;
        }
        .rv-sub {
          font-size: 14px;
          color: #64748B;
        }
        .rv-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .rv-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #EFEFEF;
          border-radius: 10px;
          padding: 0 14px;
          transition: border-color .15s;
        }
        .rv-search:focus-within {
          border-color: #1A1A1A;
        }
        .rv-search :global(svg) {
          color: #94A3B8;
          flex-shrink: 0;
        }
        .rv-search :global(input) {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          padding: 12px 0;
          background: transparent;
        }
        .rv-select {
          padding: 12px 14px;
          background: white;
          border: 1px solid #EFEFEF;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          min-width: 180px;
          outline: none;
        }
        .rv-state {
          background: white;
          border: 1px solid #EFEFEF;
          border-radius: 12px;
          padding: 60px 20px;
          text-align: center;
          color: #94A3B8;
          font-size: 14px;
        }
        .rv-table-wrap {
          background: white;
          border: 1px solid #EFEFEF;
          border-radius: 12px;
          overflow: hidden;
        }
        .rv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .rv-table :global(th) {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: .5px;
          background: #FAFAFA;
          border-bottom: 1px solid #EFEFEF;
        }
        .rv-table :global(td) {
          padding: 16px;
          border-bottom: 1px solid #F5F5F5;
          color: #1A1A1A;
        }
        .rv-table :global(tr:last-child td) {
          border-bottom: none;
        }
        .rv-table :global(tr:hover td) {
          background: #FAFAFA;
        }
        .rv-name {
          font-weight: 600;
          color: #1A1A1A;
          margin-bottom: 2px;
        }
        .rv-loja {
          font-size: 12px;
          color: #E8396A;
          font-weight: 500;
          margin-bottom: 2px;
        }
        .rv-loja-empty {
          color: #CBD5E1;
          font-style: italic;
          font-weight: 400;
        }
        .rv-email {
          font-size: 11px;
          color: #94A3B8;
        }
        .rv-saldo {
          font-weight: 600;
          color: #059669;
        }
        .rv-data {
          font-size: 12px;
          color: #94A3B8;
        }

        .rv-cards {
          display: none;
        }

        @media (max-width: 900px) {
          .rv-wrap {
            padding: 24px 20px;
          }
          .rv-filters {
            flex-direction: column;
          }
          .rv-select {
            width: 100%;
          }
          .rv-table-wrap {
            display: none;
          }
          .rv-cards {
            display: grid;
            gap: 12px;
          }
          .rv-card {
            background: white;
            border: 1px solid #EFEFEF;
            border-radius: 12px;
            padding: 16px;
          }
          .rv-card-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 12px;
          }
          .rv-card-info {
            font-size: 12px;
            color: #64748B;
            line-height: 1.7;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #F5F5F5;
          }
          .rv-card-stats {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
          }
          .rv-stat-label {
            font-size: 10px;
            color: #94A3B8;
            text-transform: uppercase;
            letter-spacing: .5px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .rv-stat-val {
            font-size: 14px;
            font-weight: 600;
            color: #1A1A1A;
          }
          .rv-title {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  )
}