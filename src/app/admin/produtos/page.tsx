'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Produto = {
  id: string
  sku: string
  nome: string
  categoria: string | null
  preco: number
  preco_promo: number | null
  fotos: string[]
  estoque: number
  destaque: boolean
  lancamento: boolean
  ativo: boolean
}

type FormData = {
  sku: string
  nome: string
  descricao: string
  categoria: string
  preco: string
  preco_promo: string
  peso_g: string
  estoque: string
  fotos: string
  marca: string
  destaque: boolean
  lancamento: boolean
  ativo: boolean
  altura_cm: string
  largura_cm: string
  comprimento_cm: string
}

const FORM_VAZIO: FormData = {
  sku: '', nome: '', descricao: '', categoria: '',
  preco: '', preco_promo: '', peso_g: '', estoque: '0',
  fotos: '', marca: '', destaque: false, lancamento: false, ativo: true,
  altura_cm: '', largura_cm: '', comprimento_cm: '',
}

export default function AdminProdutosPage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const buscaRef = useRef('')

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<FormData>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  function mostrarToast(msg: string, tipo: 'ok' | 'erro') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4000)
  }

  async function carregar(pg = page, q = busca) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), per_page: '20' })
      if (q) params.set('busca', q)
      const res = await fetch(`/api/admin/produtos?${params}`, { cache: 'no-store' })
      if (!res.ok) { setProdutos([]); return }
      const d = await res.json()
      setProdutos(d.produtos || [])
      setTotal(d.total || 0)
      setTotalPages(d.total_pages || 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'ok') {
      router.replace('/admin')
      return
    }
    carregar()
  }, [])

  function abrirCriar() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  function abrirEditar(p: Produto) {
    setEditando(p)
    setForm({
      sku: p.sku,
      nome: p.nome,
      descricao: '',
      categoria: p.categoria || '',
      preco: String(p.preco),
      preco_promo: p.preco_promo ? String(p.preco_promo) : '',
      peso_g: '',
      estoque: String(p.estoque),
      fotos: (p.fotos || []).join('\n'),
      marca: '',
      destaque: p.destaque,
      lancamento: p.lancamento,
      ativo: p.ativo,
      altura_cm: '', largura_cm: '', comprimento_cm: '',
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  function parseFotos(txt: string): string[] {
    return txt.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const payload = {
      sku: form.sku.trim(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      categoria: form.categoria.trim(),
      preco: parseFloat(form.preco.replace(',', '.')),
      preco_promo: form.preco_promo ? parseFloat(form.preco_promo.replace(',', '.')) : null,
      peso_g: form.peso_g ? parseInt(form.peso_g) : null,
      estoque: parseInt(form.estoque) || 0,
      fotos: parseFotos(form.fotos),
      marca: form.marca.trim(),
      destaque: form.destaque,
      lancamento: form.lancamento,
      ativo: form.ativo,
      altura_cm: form.altura_cm ? parseFloat(form.altura_cm) : null,
      largura_cm: form.largura_cm ? parseFloat(form.largura_cm) : null,
      comprimento_cm: form.comprimento_cm ? parseFloat(form.comprimento_cm) : null,
    }

    try {
      let res: Response
      if (editando) {
        res = await fetch(`/api/admin/produtos/${editando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/produtos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        mostrarToast(data?.erro || 'Erro ao salvar', 'erro')
      } else {
        mostrarToast(editando ? `✓ ${payload.nome} atualizado` : `✓ ${payload.nome} criado`, 'ok')
        fecharModal()
        carregar(page, busca)
      }
    } catch {
      mostrarToast('Erro de conexão', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}" permanentemente?\n\nSKU: ${p.sku}\n\nIsso não pode ser desfeito.`)) return
    setExcluindo(p.id)
    try {
      const res = await fetch(`/api/admin/produtos/${p.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        mostrarToast(data?.erro || 'Erro ao excluir', 'erro')
      } else {
        mostrarToast(`✓ ${p.nome} excluído`, 'ok')
        carregar(page, busca)
      }
    } catch {
      mostrarToast('Erro de conexão', 'erro')
    } finally {
      setExcluindo(null)
    }
  }

  async function alternarDestaque(p: Produto) {
    const res = await fetch(`/api/admin/produtos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destaque: !p.destaque }),
    })
    if (res.ok) {
      mostrarToast(`${p.destaque ? 'Removido dos' : 'Adicionado aos'} destaques`, 'ok')
      carregar(page, busca)
    }
  }

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    const q = buscaRef.current
    setPage(1)
    carregar(1, q)
  }

  return (
    <div className="prd-wrap">
      {toast && (
        <div className="prd-toast" data-tipo={toast.tipo}>{toast.msg}</div>
      )}

      <header className="prd-top">
        <a href="/admin" className="prd-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Voltar ao backoffice
        </a>
      </header>

      <div className="prd-hero">
        <div>
          <div className="prd-eyebrow">Catálogo</div>
          <div className="prd-title">Produtos</div>
          <div className="prd-sub">{total} produto(s) cadastrado(s)</div>
        </div>
        <button className="prd-btn-novo" onClick={abrirCriar}>
          + Novo produto
        </button>
      </div>

      <form className="prd-filters" onSubmit={handleBusca}>
        <div className="prd-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Buscar por nome ou SKU…"
            defaultValue={busca}
            onChange={e => { buscaRef.current = e.target.value; setBusca(e.target.value) }}
          />
        </div>
        <button type="submit" className="prd-btn-buscar">Buscar</button>
      </form>

      {loading ? (
        <div className="prd-state">Carregando…</div>
      ) : produtos.length === 0 ? (
        <div className="prd-state">Nenhum produto encontrado</div>
      ) : (
        <>
          <div className="prd-grid">
            {produtos.map(p => (
              <div key={p.id} className="prd-card" data-inativo={!p.ativo ? 'true' : undefined}>
                <div className="prd-card-foto">
                  {p.fotos?.[0] ? (
                    <img src={p.fotos[0]} alt={p.nome} />
                  ) : (
                    <div className="prd-foto-vazia">sem foto</div>
                  )}
                  {p.destaque && <span className="prd-badge-destaque">★ destaque</span>}
                  {p.lancamento && <span className="prd-badge-lancamento">novo</span>}
                  {!p.ativo && <span className="prd-badge-inativo">inativo</span>}
                </div>
                <div className="prd-card-body">
                  <div className="prd-card-cat">{p.categoria || '—'}</div>
                  <div className="prd-card-nome">{p.nome}</div>
                  <div className="prd-card-sku">SKU: {p.sku}</div>
                  <div className="prd-card-preco">
                    {p.preco_promo ? (
                      <>
                        <span className="prd-preco-de">{formatBRL(p.preco)}</span>
                        <span className="prd-preco-por">{formatBRL(p.preco_promo)}</span>
                      </>
                    ) : (
                      <span className="prd-preco-por">{formatBRL(p.preco)}</span>
                    )}
                    <span className="prd-estoque">estoque: {p.estoque}</span>
                  </div>
                  <div className="prd-card-acoes">
                    <button className="prd-btn-editar" onClick={() => abrirEditar(p)}>Editar</button>
                    <button
                      className="prd-btn-destaque"
                      onClick={() => alternarDestaque(p)}
                      title={p.destaque ? 'Remover destaque' : 'Marcar como destaque'}
                    >
                      {p.destaque ? '★' : '☆'}
                    </button>
                    <button
                      className="prd-btn-excluir"
                      onClick={() => excluir(p)}
                      disabled={excluindo === p.id}
                    >
                      {excluindo === p.id ? '…' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="prd-paginacao">
              <button
                className="prd-btn-pag"
                disabled={page <= 1}
                onClick={() => { const pg = page - 1; setPage(pg); carregar(pg, busca) }}
              >← Anterior</button>
              <span className="prd-pag-info">Página {page} de {totalPages}</span>
              <button
                className="prd-btn-pag"
                disabled={page >= totalPages}
                onClick={() => { const pg = page + 1; setPage(pg); carregar(pg, busca) }}
              >Próxima →</button>
            </div>
          )}
        </>
      )}

      {modalAberto && (
        <div className="prd-modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="prd-modal">
            <div className="prd-modal-header">
              <div className="prd-modal-titulo">{editando ? 'Editar produto' : 'Novo produto'}</div>
              <button className="prd-modal-fechar" onClick={fecharModal}>✕</button>
            </div>
            <form className="prd-form" onSubmit={salvar}>
              <div className="prd-form-row">
                <div className="prd-field">
                  <label>SKU *</label>
                  <input
                    value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    placeholder="ex: VEL-001"
                    disabled={!!editando}
                    required
                  />
                </div>
                <div className="prd-field prd-field-lg">
                  <label>Nome *</label>
                  <input
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome do produto"
                    required
                  />
                </div>
              </div>

              <div className="prd-form-row">
                <div className="prd-field">
                  <label>Categoria</label>
                  <input
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="ex: Colares, Eau de Parfum"
                  />
                </div>
                <div className="prd-field">
                  <label>Marca</label>
                  <input
                    value={form.marca}
                    onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                    placeholder="ex: Áurea"
                  />
                </div>
              </div>

              <div className="prd-field">
                <label>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição do produto para a vitrine"
                  rows={3}
                />
              </div>

              <div className="prd-form-row">
                <div className="prd-field">
                  <label>Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.preco}
                    onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                    placeholder="89.90"
                    required
                  />
                </div>
                <div className="prd-field">
                  <label>Preço promo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.preco_promo}
                    onChange={e => setForm(f => ({ ...f, preco_promo: e.target.value }))}
                    placeholder="deixe vazio se não tiver"
                  />
                </div>
                <div className="prd-field">
                  <label>Estoque</label>
                  <input
                    type="number"
                    min="0"
                    value={form.estoque}
                    onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))}
                  />
                </div>
              </div>

              <div className="prd-field">
                <label>Fotos (URLs, uma por linha)</label>
                <textarea
                  value={form.fotos}
                  onChange={e => setForm(f => ({ ...f, fotos: e.target.value }))}
                  placeholder={'https://...\nhttps://...'}
                  rows={2}
                />
              </div>

              <div className="prd-form-row prd-form-row-sm">
                <div className="prd-field">
                  <label>Peso (g)</label>
                  <input type="number" min="0" value={form.peso_g} onChange={e => setForm(f => ({ ...f, peso_g: e.target.value }))} />
                </div>
                <div className="prd-field">
                  <label>Altura (cm)</label>
                  <input type="number" step="0.1" min="0" value={form.altura_cm} onChange={e => setForm(f => ({ ...f, altura_cm: e.target.value }))} />
                </div>
                <div className="prd-field">
                  <label>Largura (cm)</label>
                  <input type="number" step="0.1" min="0" value={form.largura_cm} onChange={e => setForm(f => ({ ...f, largura_cm: e.target.value }))} />
                </div>
                <div className="prd-field">
                  <label>Comprimento (cm)</label>
                  <input type="number" step="0.1" min="0" value={form.comprimento_cm} onChange={e => setForm(f => ({ ...f, comprimento_cm: e.target.value }))} />
                </div>
              </div>

              <div className="prd-form-checks">
                <label className="prd-check">
                  <input type="checkbox" checked={form.destaque} onChange={e => setForm(f => ({ ...f, destaque: e.target.checked }))} />
                  ★ Destaque na vitrine
                </label>
                <label className="prd-check">
                  <input type="checkbox" checked={form.lancamento} onChange={e => setForm(f => ({ ...f, lancamento: e.target.checked }))} />
                  🆕 Lançamento
                </label>
                <label className="prd-check">
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
                  ✓ Ativo (visível na vitrine)
                </label>
              </div>

              <div className="prd-form-footer">
                <button type="button" className="prd-btn-cancelar" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="prd-btn-salvar" disabled={salvando}>
                  {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .prd-wrap {
          width: 100%;
          min-height: 100vh;
          padding: 40px 56px 56px;
          box-sizing: border-box;
          background: #FAFAFA;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
        }
        .prd-toast {
          position: fixed; top: 20px; right: 20px; z-index: 200;
          padding: 12px 18px; border-radius: 10px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 6px 20px rgba(0,0,0,.08);
          max-width: 360px;
        }
        .prd-toast[data-tipo="ok"] { background: #D1FAE5; border: 1px solid #10B981; color: #065F46; }
        .prd-toast[data-tipo="erro"] { background: #FEE2E2; border: 1px solid #EF4444; color: #991B1B; }
        .prd-top { margin-bottom: 24px; }
        .prd-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: #64748B; text-decoration: none;
          padding: 6px 10px; border-radius: 6px; transition: all .15s;
        }
        .prd-back:hover { background: #F5F5F5; color: #1A1A1A; }
        .prd-hero {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 32px;
        }
        .prd-eyebrow { font-size: 11px; font-weight: 600; color: #E8396A; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
        .prd-title { font-size: 32px; font-weight: 700; color: #1A1A1A; letter-spacing: -.5px; margin-bottom: 6px; }
        .prd-sub { font-size: 14px; color: #64748B; }
        .prd-btn-novo {
          padding: 12px 20px; background: #1A1A1A; color: white;
          border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: opacity .15s;
        }
        .prd-btn-novo:hover { opacity: .85; }
        .prd-filters { display: flex; gap: 10px; margin-bottom: 24px; }
        .prd-search {
          flex: 1; display: flex; align-items: center; gap: 10px;
          background: white; border: 1px solid #EFEFEF; border-radius: 10px;
          padding: 0 14px; transition: border-color .15s;
        }
        .prd-search:focus-within { border-color: #1A1A1A; }
        .prd-search :global(svg) { color: #94A3B8; flex-shrink: 0; }
        .prd-search :global(input) {
          flex: 1; border: none; outline: none; font-size: 14px; padding: 12px 0; background: transparent;
        }
        .prd-btn-buscar {
          padding: 12px 20px; background: white; border: 1px solid #E5E7EB;
          border-radius: 10px; font-size: 14px; font-weight: 600; color: #374151;
          cursor: pointer; transition: all .15s;
        }
        .prd-btn-buscar:hover { border-color: #1A1A1A; }
        .prd-state {
          background: white; border: 1px solid #EFEFEF; border-radius: 12px;
          padding: 60px 20px; text-align: center; color: #94A3B8; font-size: 14px;
        }
        .prd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px; margin-bottom: 24px;
        }
        .prd-card {
          background: white; border: 1px solid #EFEFEF; border-radius: 12px;
          overflow: hidden; transition: box-shadow .15s;
        }
        .prd-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.06); }
        .prd-card[data-inativo] { opacity: .6; }
        .prd-card-foto {
          position: relative; height: 180px; overflow: hidden;
          background: #F8F9FA;
        }
        .prd-card-foto img { width: 100%; height: 100%; object-fit: cover; }
        .prd-foto-vazia { display: flex; align-items: center; justify-content: center; height: 100%; color: #CBD5E1; font-size: 13px; }
        .prd-badge-destaque {
          position: absolute; top: 8px; left: 8px;
          background: #FBBF24; color: #78350F;
          font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .prd-badge-lancamento {
          position: absolute; top: 8px; right: 8px;
          background: #6366F1; color: white;
          font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .prd-badge-inativo {
          position: absolute; bottom: 8px; left: 8px;
          background: #EF4444; color: white;
          font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .prd-card-body { padding: 12px; }
        .prd-card-cat { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .prd-card-nome { font-size: 13px; font-weight: 600; color: #1A1A1A; margin-bottom: 4px; line-height: 1.3; }
        .prd-card-sku { font-size: 11px; color: #94A3B8; font-family: monospace; margin-bottom: 8px; }
        .prd-card-preco { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .prd-preco-de { font-size: 12px; color: #94A3B8; text-decoration: line-through; }
        .prd-preco-por { font-size: 15px; font-weight: 700; color: #059669; }
        .prd-estoque { font-size: 11px; color: #94A3B8; margin-left: auto; }
        .prd-card-acoes { display: flex; gap: 6px; }
        .prd-btn-editar {
          flex: 1; padding: 7px 0; background: #EEF2FF;
          border: 1px solid #C7D2FE; border-radius: 8px;
          font-size: 12px; font-weight: 600; color: #4338CA;
          cursor: pointer; transition: all .15s;
        }
        .prd-btn-editar:hover { background: #E0E7FF; }
        .prd-btn-destaque {
          padding: 7px 10px; background: white;
          border: 1px solid #E5E7EB; border-radius: 8px;
          font-size: 14px; cursor: pointer; transition: all .15s;
        }
        .prd-btn-destaque:hover { background: #FEF9C3; border-color: #FCD34D; }
        .prd-btn-excluir {
          padding: 7px 10px; background: #FEE2E2;
          border: 1px solid #FCA5A5; border-radius: 8px;
          font-size: 12px; cursor: pointer; transition: all .15s;
        }
        .prd-btn-excluir:hover { background: #FECACA; }
        .prd-btn-excluir:disabled { opacity: .5; cursor: wait; }
        .prd-paginacao {
          display: flex; align-items: center; justify-content: center;
          gap: 16px; margin-top: 24px;
        }
        .prd-btn-pag {
          padding: 10px 20px; background: white; border: 1px solid #E5E7EB;
          border-radius: 8px; font-size: 13px; font-weight: 600; color: #374151;
          cursor: pointer; transition: all .15s;
        }
        .prd-btn-pag:hover:not(:disabled) { border-color: #1A1A1A; }
        .prd-btn-pag:disabled { opacity: .4; cursor: not-allowed; }
        .prd-pag-info { font-size: 13px; color: #64748B; }

        /* Modal */
        .prd-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,.4);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .prd-modal {
          background: white; border-radius: 16px; width: 100%; max-width: 640px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,.15);
        }
        .prd-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid #F5F5F5;
          position: sticky; top: 0; background: white; z-index: 1;
        }
        .prd-modal-titulo { font-size: 17px; font-weight: 700; color: #1A1A1A; }
        .prd-modal-fechar {
          background: none; border: none; font-size: 18px; color: #94A3B8;
          cursor: pointer; padding: 4px 8px; border-radius: 4px;
        }
        .prd-modal-fechar:hover { color: #1A1A1A; background: #F5F5F5; }
        .prd-form { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .prd-form-row { display: flex; gap: 12px; }
        .prd-form-row-sm { flex-wrap: wrap; }
        .prd-form-row-sm .prd-field { flex: 1; min-width: 100px; }
        .prd-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .prd-field-lg { flex: 2; }
        .prd-field label { font-size: 12px; font-weight: 600; color: #374151; }
        .prd-field input, .prd-field textarea {
          padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 8px;
          font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s;
        }
        .prd-field input:focus, .prd-field textarea:focus { border-color: #1A1A1A; }
        .prd-field input:disabled { background: #F9FAFB; color: #6B7280; cursor: not-allowed; }
        .prd-form-checks { display: flex; gap: 20px; flex-wrap: wrap; }
        .prd-check {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #374151; cursor: pointer;
        }
        .prd-check input { width: 16px; height: 16px; cursor: pointer; }
        .prd-form-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding-top: 8px; border-top: 1px solid #F5F5F5;
        }
        .prd-btn-cancelar {
          padding: 11px 20px; background: white; border: 1px solid #E5E7EB;
          border-radius: 8px; font-size: 14px; font-weight: 600; color: #374151;
          cursor: pointer;
        }
        .prd-btn-salvar {
          padding: 11px 24px; background: #1A1A1A; color: white;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: opacity .15s;
        }
        .prd-btn-salvar:disabled { opacity: .6; cursor: wait; }

        @media (max-width: 900px) {
          .prd-wrap { padding: 24px 20px; }
          .prd-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
          .prd-form-row { flex-direction: column; }
          .prd-form-checks { flex-direction: column; gap: 12px; }
        }
      `}</style>
    </div>
  )
}
