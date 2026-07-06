'use client'

// /admin/pedidos/[id]/imprimir — FOLHA DE PEDIDO PARA ENVIO AO CLIENTE.
// Vai DENTRO da encomenda → marca da REVENDEDORA (logo + nome da loja),
// nunca "Loja de Prata 925"/"Revendedoras". Contém: nº do pedido, dados e
// endereço do cliente, telefone, itens com referência Tray (pra identificar),
// observação do cliente, tipo de frete, subtotal + frete + total.
// Auto-dispara window.print() ao carregar.

import { useEffect, useState, useCallback } from 'react'

type Item = {
  id?: string
  sku?: string
  nome?: string
  preco?: number
  quantidade?: number
  variacao?: string
  ref?: string
  foto?: string
}

type Pedido = {
  id: string
  numero_pedido: string
  created_at: string
  status: string
  cliente_nome: string
  cliente_email: string
  cliente_cpf?: string | null
  cliente_telefone?: string | null
  endereco_cep: string
  endereco_rua: string
  endereco_numero: string
  endereco_complemento?: string | null
  endereco_bairro: string
  endereco_cidade: string
  endereco_uf: string
  itens: Item[] | null
  subtotal: number
  frete: number
  total: number
  frete_servico?: string | null
  observacoes?: string | null
  codigo_rastreio?: string | null
  slug_revendedora?: string | null
  revendedora?: {
    nome: string
    nome_loja: string | null
    whatsapp: string
    subdominio: string
    foto_url: string | null
    cidade: string | null
    estado: string | null
  } | null
}

function fmtBRL(v: number | undefined) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}
function labelFrete(servico?: string | null): string {
  if (!servico) return ''
  const s = servico.toUpperCase()
  if (s === 'PAC') return 'PAC'
  if (s === 'SEDEX') return 'SEDEX'
  if (s === 'PADRAO') return 'Padrão'
  return servico
}

// Pedido de EXEMPLO pra simular a folha (rota /admin/pedidos/simulacao/imprimir).
// Não bate no banco nem precisa de pedido real — só pra ver/imprimir o layout.
const PEDIDO_SIMULACAO: Pedido = {
  id: 'simulacao',
  numero_pedido: 'PED-20260624-0001',
  created_at: new Date().toISOString(),
  status: 'pago',
  cliente_nome: 'Maria Oliveira Santos',
  cliente_email: 'maria.cliente@email.com',
  cliente_cpf: '123.456.789-00',
  cliente_telefone: '(11) 98888-7777',
  endereco_cep: '01310-100',
  endereco_rua: 'Avenida Paulista',
  endereco_numero: '1000',
  endereco_complemento: 'Apto 52',
  endereco_bairro: 'Bela Vista',
  endereco_cidade: 'São Paulo',
  endereco_uf: 'SP',
  itens: [
    { quantidade: 1, ref: '26124', sku: '26124', nome: 'Pulseira de prata 925 com pingente gota zircônia', variacao: 'Único', preco: 97.90, foto: '' },
    { quantidade: 2, ref: '13385', sku: '13385', nome: 'Piercing de prata 925 argolinha lisa', variacao: '8mm', preco: 25.90, foto: '' },
  ],
  subtotal: 149.70,
  frete: 18.50,
  total: 168.20,
  frete_servico: 'SEDEX',
  observacoes: 'Por favor, embalar para presente. Obrigada! 🎁',
  codigo_rastreio: 'AA123456789BR',
  slug_revendedora: 'joias-da-ana',
  revendedora: { nome: 'Ana Costa', nome_loja: 'Joias da Ana', whatsapp: '11999998888', subdominio: 'joias-da-ana', foto_url: null, cidade: 'São Paulo', estado: 'SP' },
}

export default function ImprimirPedidoPage({ params }: { params: { id: string } }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Modo simulação: mostra um pedido de exemplo, sem bater no banco.
    if (params.id === 'simulacao') {
      setPedido(PEDIDO_SIMULACAO)
      setCarregando(false)
      return
    }
    fetch(`/api/admin/pedidos/${params.id}`, { cache: 'no-store', credentials: 'include' })
      .then(async r => {
        if (!r.ok) {
          setErro(r.status === 401 ? 'Não autorizado. Faça login no /admin.' : 'Pedido não encontrado.')
          return null
        }
        return r.json()
      })
      .then(d => { if (d) setPedido(d as Pedido) })
      .catch(() => setErro('Falha ao carregar pedido.'))
      .finally(() => setCarregando(false))
  }, [params.id])

  const dispararImpressao = useCallback(() => {
    if (typeof window !== 'undefined') window.print()
  }, [])

  // Auto-print depois de carregar (espera 1500ms p/ as fotos baixarem).
  useEffect(() => {
    // Não auto-imprime na simulação — deixa olhar primeiro e clicar Imprimir.
    if (pedido && !erro && params.id !== 'simulacao') {
      const t = setTimeout(() => dispararImpressao(), 1500)
      return () => clearTimeout(t)
    }
  }, [pedido, erro, dispararImpressao, params.id])

  if (carregando) {
    return <div className="ip-loading">Carregando pedido…</div>
  }
  if (erro || !pedido) {
    return <div className="ip-loading">{erro || 'Pedido não encontrado'}</div>
  }

  const itens = Array.isArray(pedido.itens) ? pedido.itens : []
  const totalQtd = itens.reduce((s, i) => s + Number(i.quantidade || 0), 0)
  const rev = pedido.revendedora
  const nomeLoja = rev?.nome_loja || rev?.nome || 'Sua loja'
  const inicial = (nomeLoja[0] || '?').toUpperCase()
  const localLoja = [rev?.cidade, rev?.estado].filter(Boolean).join('/')
  const freteLbl = labelFrete(pedido.frete_servico)

  return (
    <div className="ip-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Toolbar — só na tela, some no print */}
      <div className="ip-toolbar no-print">
        <button onClick={() => window.history.back()} className="ip-btn-ghost">← Voltar</button>
        <button onClick={dispararImpressao} className="ip-btn-primary">🖨️ Imprimir</button>
      </div>

      {/* Cabeçalho — marca da REVENDEDORA (logo + nome da loja) */}
      <div className="ip-header">
        <div className="ip-brand-wrap">
          {rev?.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rev.foto_url} alt={nomeLoja} className="ip-logo" />
          ) : (
            <div className="ip-logo ip-logo-ph">{inicial}</div>
          )}
          <div>
            <div className="ip-brand">{nomeLoja}</div>
            {localLoja && <div className="ip-brand-sub">{localLoja}</div>}
          </div>
        </div>
        <div className="ip-num">
          <div className="ip-num-label">Pedido nº</div>
          <div className="ip-num-val">{pedido.numero_pedido}</div>
          <div className="ip-num-data">{fmtData(pedido.created_at)}</div>
        </div>
      </div>

      {/* Cliente + entrega */}
      <div className="ip-cols">
        <div className="ip-card">
          <div className="ip-card-tit">Cliente</div>
          <div className="ip-card-row"><strong>{pedido.cliente_nome}</strong></div>
          {pedido.cliente_telefone && <div className="ip-card-row">📞 {pedido.cliente_telefone}</div>}
          {pedido.cliente_email && <div className="ip-card-row">{pedido.cliente_email}</div>}
          {pedido.cliente_cpf && <div className="ip-card-row">CPF: {pedido.cliente_cpf}</div>}
        </div>
        <div className="ip-card">
          <div className="ip-card-tit">Endereço de entrega</div>
          <div className="ip-card-row">
            {pedido.endereco_rua}, {pedido.endereco_numero}
            {pedido.endereco_complemento && ` — ${pedido.endereco_complemento}`}
          </div>
          <div className="ip-card-row">{pedido.endereco_bairro}</div>
          <div className="ip-card-row">{pedido.endereco_cidade} — {pedido.endereco_uf}</div>
          <div className="ip-card-row">CEP: {pedido.endereco_cep}</div>
        </div>
      </div>

      {/* Itens */}
      <div className="ip-secao-tit">
        Itens do pedido ({totalQtd} {totalQtd === 1 ? 'peça' : 'peças'})
      </div>
      <table className="ip-tab">
        <thead>
          <tr>
            <th style={{ width: 64 }}>Foto</th>
            <th style={{ width: 46 }}>Qtd</th>
            <th style={{ width: 110 }}>Referência</th>
            <th>Produto</th>
            <th>Variação</th>
            <th style={{ width: 96, textAlign: 'right' }}>Preço un.</th>
          </tr>
        </thead>
        <tbody>
          {itens.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 14, color: '#999' }}>Sem itens.</td></tr>
          )}
          {itens.map((it, i) => (
            <tr key={i}>
              <td className="ip-foto-cell">
                {it.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.foto} alt={it.nome || ''} className="ip-foto" />
                ) : (
                  <div className="ip-foto-vazia">—</div>
                )}
              </td>
              <td className="ip-qtd">{it.quantidade || 1}</td>
              <td className="ip-ref">{it.ref || it.sku || <span className="ip-muted">—</span>}</td>
              <td>{it.nome || '—'}</td>
              <td>{it.variacao || <span className="ip-muted">—</span>}</td>
              <td style={{ textAlign: 'right' }}>{fmtBRL(it.preco)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Observação do cliente */}
      {pedido.observacoes && (
        <>
          <div className="ip-secao-tit">Observação do cliente</div>
          <div className="ip-obs">{pedido.observacoes}</div>
        </>
      )}

      {/* Totais (subtotal + frete + total) */}
      <div className="ip-totais">
        <div><span>Subtotal</span><span>{fmtBRL(pedido.subtotal)}</span></div>
        <div><span>Frete{freteLbl ? ` (${freteLbl})` : ''}</span><span>{fmtBRL(pedido.frete)}</span></div>
        <div className="ip-total-final"><span>TOTAL</span><span>{fmtBRL(pedido.total)}</span></div>
      </div>

      {/* Rastreio */}
      {pedido.codigo_rastreio && (
        <div className="ip-rastreio">
          📦 Código de rastreio: <strong>{pedido.codigo_rastreio}</strong>
        </div>
      )}

      <div className="ip-rodape">
        {nomeLoja}{rev?.whatsapp ? ` · WhatsApp ${rev.whatsapp}` : ''} · Obrigada pela sua compra! 💎
      </div>
    </div>
  )
}

const CSS = `
/* Esconde a barra "Logado como/Sair" e o rodapé "Multiplica" — não fazem
   parte do documento e estavam se sobrepondo. Some na tela e no print. */
.admin-user-badge, .multiplica-footer { display: none !important; }

@media print {
  @page { size: A4; margin: 12mm; }
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .ip-foto, .ip-logo, .ip-tab th, .ip-total-final { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
.ip-wrap { font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px 28px; color: #0F172A; background: #fff; }
.ip-loading { padding: 60px 20px; text-align: center; color: #64748B; font-family: Inter, sans-serif; }
.ip-toolbar { display: flex; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #CBD5E1; }
.ip-btn-ghost { background: #fff; border: 1px solid #CBD5E1; color: #475569; padding: 8px 14px; border-radius: 8px; cursor: pointer; font: 600 13px Inter, sans-serif; }
.ip-btn-primary { background: #0F172A; color: #fff; border: 0; padding: 9px 18px; border-radius: 8px; cursor: pointer; font: 700 13px Inter, sans-serif; }
.ip-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 2px solid #0F172A; margin-bottom: 18px; gap: 16px; }
.ip-brand-wrap { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ip-logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #E2E8F0; flex-shrink: 0; background: #fff; }
.ip-logo-ph { display: flex; align-items: center; justify-content: center; background: #0F172A; color: #fff; font: 800 22px 'Playfair Display', serif; }
.ip-brand { font: 800 22px 'Playfair Display', serif; letter-spacing: -.5px; line-height: 1.1; }
.ip-brand-sub { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
.ip-num { text-align: right; flex-shrink: 0; }
.ip-num-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; }
.ip-num-val { font: 700 17px monospace; color: #0F172A; }
.ip-num-data { font-size: 11px; color: #64748B; margin-top: 2px; }
.ip-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
.ip-card { padding: 14px 16px; border: 1px solid #E2E8F0; border-radius: 10px; background: #fff; }
.ip-card-tit { font: 800 11px Inter, sans-serif; color: #0F172A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
.ip-card-row { font-size: 13px; color: #1E293B; margin-bottom: 3px; line-height: 1.45; }
.ip-secao-tit { font: 800 13px Inter, sans-serif; color: #0F172A; text-transform: uppercase; letter-spacing: 1px; margin: 18px 0 10px; }
.ip-tab { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ip-tab th { text-align: left; padding: 8px 10px; background: #0F172A; color: #fff; font: 800 11px Inter, sans-serif; text-transform: uppercase; letter-spacing: .5px; }
.ip-tab td { padding: 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
.ip-tab tr:nth-child(even) td { background: #F8FAFC; }
.ip-foto-cell { padding: 6px !important; text-align: center; }
.ip-foto { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; border: 1px solid #E2E8F0; display: block; margin: 0 auto; background: #fff; }
.ip-foto-vazia { width: 52px; height: 52px; border-radius: 6px; background: #F1F5F9; color: #CBD5E1; display: flex; align-items: center; justify-content: center; font-size: 18px; margin: 0 auto; }
.ip-qtd { font: 800 16px monospace; text-align: center; color: #DC2626; }
.ip-ref { font: 800 13px monospace; color: #1E40AF; }
.ip-muted { color: #CBD5E1; }
.ip-obs { padding: 12px 16px; background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 6px; font-size: 13px; color: #78350F; white-space: pre-wrap; line-height: 1.5; margin-bottom: 18px; }
.ip-totais { margin-top: 18px; padding-top: 12px; border-top: 1px solid #E2E8F0; max-width: 320px; margin-left: auto; }
.ip-totais > div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
.ip-total-final { font: 800 17px 'Playfair Display', serif; padding-top: 8px !important; border-top: 1px solid #0F172A; margin-top: 4px; }
.ip-rastreio { margin-top: 18px; padding: 10px 14px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; font-size: 13px; color: #1E40AF; }
.ip-rodape { margin-top: 28px; padding-top: 14px; border-top: 1px dashed #CBD5E1; text-align: center; font-size: 11px; color: #64748B; }
@media (max-width: 700px) {
  .ip-cols { grid-template-columns: 1fr; }
  .ip-wrap { padding: 16px; }
}
`
