'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { brand } from '@/lib/brand'
import { TEMAS_LOJA, COR_PADRAO, corValida, FONTES_LOJA, FONTE_PADRAO, fonteValida, FUNDOS_LOJA, FUNDO_PADRAO, fundoValido, BANNERS_LOJA, BANNER_PADRAO, bannerValido, HERO_TEXTO_CORES, HERO_TEXTO_COR_PADRAO, heroTextoCorValida, heroTextoHexReal } from '@/lib/temasLoja'
import BottomNav from '@/components/dashboard/BottomNav'
import BannerPagamentoPendente from '@/components/dashboard/BannerPagamentoPendente'
import CropperModal from '@/components/CropperModal'

export default function ConfigurarLojaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [nome, setNome] = useState('')
  const [statusConta, setStatusConta] = useState<string | null>(null)
  const [nomeLoja, setNomeLoja] = useState('')
  const [whatsappMensagem, setWhatsappMensagem] = useState('')
  const [cor, setCor] = useState<string>(COR_PADRAO)
  const [fonte, setFonte] = useState<string>(FONTE_PADRAO.id)
  const [corFundo, setCorFundo] = useState<string>(FUNDO_PADRAO.id)
  const [bannerPreset, setBannerPreset] = useState<string>(BANNER_PADRAO.id)
  const [videoUrl, setVideoUrl] = useState('')
  const [cintaCor, setCintaCor] = useState<string>(COR_PADRAO)
  const [mostrarTexto, setMostrarTexto] = useState(true)
  const [heroTextoCor, setHeroTextoCor] = useState<string>(HERO_TEXTO_COR_PADRAO.id)
  // Texto editável do banner. Vazio = usa default "Joias que contam"
  // / "histórias suas". Preenchido = substitui pelo que a revendedora pôs.
  const [heroTitulo, setHeroTitulo] = useState('')
  const [heroSubtitulo, setHeroSubtitulo] = useState('')
  // Toggles dos blocos opcionais do storefront. Default = ligados.
  const [blocoPrata925, setBlocoPrata925] = useState(true)
  const [blocoDepoimentos, setBlocoDepoimentos] = useState(true)
  const [blocoGarantias, setBlocoGarantias] = useState(true)
  const [bannerOverlay, setBannerOverlay] = useState(true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Novos: bio, banner, redes sociais
  const [bio, setBio] = useState('')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [bannerArquivo, setBannerArquivo] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  // Modal de recorte: abrir ao selecionar arquivo; ao confirmar vira o
  // file/preview que sobe pro servidor.
  const [cropSrc, setCropSrc] = useState<{ tipo: 'logo' | 'banner'; src: string } | null>(null)
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [subdominio, setSubdominio] = useState<string | null>(null)
  // URL editável: começa = subdominio carregado. Editar troca o slug
  // da loja. Validamos no server (regra + uniqueness).
  const [subdominioEdit, setSubdominioEdit] = useState('')
  const [editandoUrl, setEditandoUrl] = useState(false)

  // Texto → slug seguro (lowercase, sem acento, espaços = hífen).
  // Usado pra sugerir URL a partir do nome da loja.
  function gerarSlug(texto: string): string {
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

  function flash(msg: string, tipo: 'ok' | 'erro') {
    if (toastT.current) clearTimeout(toastT.current)
    setToast({ msg, tipo })
    toastT.current = setTimeout(() => setToast(null), 2800)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('nome, status, nome_loja, cor_tema, fonte, cor_fundo, banner_preset, video_url, cinta_cor, mostrar_hero_texto, banner_overlay, hero_texto_cor, hero_titulo, hero_subtitulo, mostrar_bloco_prata925, mostrar_bloco_depoimentos, mostrar_bloco_garantias, foto_url, bio, whatsapp_mensagem, banner_url, instagram, tiktok, subdominio')
        .eq('user_id', user.id)
        .single()
      if (rev) {
        setNome(rev.nome || '')
        setStatusConta(rev.status || null)
        setWhatsappMensagem(rev.whatsapp_mensagem || '')
        setNomeLoja(rev.nome_loja || '')
        setCor(corValida(rev.cor_tema))
        setFonte(fonteValida(rev.fonte).id)
        setCorFundo(fundoValido(rev.cor_fundo).id)
        setBannerPreset(bannerValido(rev.banner_preset).id)
        setVideoUrl(rev.video_url || '')
        setCintaCor(corValida(rev.cinta_cor))
        setMostrarTexto(rev.mostrar_hero_texto !== false)
        setHeroTextoCor(heroTextoCorValida(rev.hero_texto_cor).id)
        setHeroTitulo(rev.hero_titulo || '')
        setHeroSubtitulo(rev.hero_subtitulo || '')
        setBlocoPrata925(rev.mostrar_bloco_prata925 !== false)
        setBlocoDepoimentos(rev.mostrar_bloco_depoimentos !== false)
        setBlocoGarantias(rev.mostrar_bloco_garantias !== false)
        setBannerOverlay(rev.banner_overlay !== false)
        setFotoUrl(rev.foto_url || null)
        setBio(rev.bio || '')
        setBannerUrl(rev.banner_url || null)
        setInstagram(rev.instagram || '')
        setTiktok(rev.tiktok || '')
        setSubdominio(rev.subdominio || null)
        setSubdominioEdit(rev.subdominio || '')
      }
      setLoading(false)
    }
    load()
  }, [router])

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      flash('Use PNG, JPG ou WEBP', 'erro')
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      flash('Imagem muito grande (máx 8MB)', 'erro')
      return
    }
    // Abre o modal de recorte; o arquivo final vem do crop (comprimido).
    setCropSrc({ tipo: 'logo', src: URL.createObjectURL(f) })
    // limpa o input pra permitir re-selecionar o mesmo arquivo depois
    e.target.value = ''
  }

  function onBannerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      flash('Use PNG, JPG ou WEBP', 'erro')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      flash('Banner muito grande (máx 10MB)', 'erro')
      return
    }
    setCropSrc({ tipo: 'banner', src: URL.createObjectURL(f) })
    e.target.value = ''
  }

  // Recebe o blob recortado do CropperModal e vira o file/preview pronto pro upload.
  function aplicarRecorte(blob: Blob) {
    if (!cropSrc) return
    const file = new File([blob], `${cropSrc.tipo}.jpg`, { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    if (cropSrc.tipo === 'logo') {
      setArquivo(file)
      setPreview(url)
    } else {
      setBannerArquivo(file)
      setBannerPreview(url)
    }
    URL.revokeObjectURL(cropSrc.src)
    setCropSrc(null)
  }

  async function removerBanner() {
    setBannerArquivo(null)
    setBannerPreview(null)
    if (!bannerUrl) return
    const t = await token()
    if (!t) return
    const r = await fetch('/api/revendedora/banner', { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
    if (r.ok) {
      setBannerUrl(null)
      flash('Banner removido', 'ok')
    } else {
      flash('Erro ao remover banner', 'erro')
    }
  }

  async function token(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  async function salvar() {
    if (salvando) return
    setSalvando(true)
    try {
      const t = await token()
      if (!t) { router.push('/auth/login'); return }

      if (arquivo) {
        const fd = new FormData()
        fd.append('file', arquivo)
        const rl = await fetch('/api/revendedora/logo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
          body: fd,
        })
        const dl = await rl.json()
        if (!rl.ok) { flash(dl?.erro || 'Erro ao subir o logo', 'erro'); setSalvando(false); return }
        setFotoUrl(dl.foto_url)
        setArquivo(null)
      }

      if (bannerArquivo) {
        const fd = new FormData()
        fd.append('file', bannerArquivo)
        const rb = await fetch('/api/revendedora/banner', {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
          body: fd,
        })
        const db = await rb.json()
        if (!rb.ok) { flash(db?.erro || 'Erro ao subir o banner', 'erro'); setSalvando(false); return }
        setBannerUrl(db.banner_url)
        setBannerArquivo(null)
        setBannerPreview(null)
      }

      const rc = await fetch('/api/revendedora/loja', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_loja: nomeLoja,
          // Só envia subdominio se mudou — evita 409 quando ela não tocou nessa parte.
          ...(editandoUrl && subdominioEdit && subdominioEdit !== subdominio
            ? { subdominio: subdominioEdit }
            : {}),
          cor_tema: cor === COR_PADRAO ? null : cor,
          fonte: fonte === FONTE_PADRAO.id ? null : fonte,
          cor_fundo: corFundo === FUNDO_PADRAO.id ? null : corFundo,
          banner_preset: bannerPreset === BANNER_PADRAO.id ? null : bannerPreset,
          video_url: videoUrl.trim() || null,
          cinta_cor: cintaCor === COR_PADRAO ? null : cintaCor,
          mostrar_hero_texto: mostrarTexto,
          hero_texto_cor: heroTextoCor === HERO_TEXTO_COR_PADRAO.id ? null : heroTextoCor,
          hero_titulo: heroTitulo.trim() || null,
          hero_subtitulo: heroSubtitulo.trim() || null,
          mostrar_bloco_prata925: blocoPrata925,
          mostrar_bloco_depoimentos: blocoDepoimentos,
          mostrar_bloco_garantias: blocoGarantias,
          banner_overlay: bannerOverlay,
          bio: bio || null,
          whatsapp_mensagem: whatsappMensagem.trim() || null,
          instagram: instagram || null,
          tiktok: tiktok || null,
        }),
      })
      const dc = await rc.json()
      if (!rc.ok) { flash(dc?.erro || 'Erro ao salvar', 'erro'); setSalvando(false); return }

      // Se ela trocou o slug com sucesso, atualiza state local pra refletir.
      if (dc?.subdominio) {
        setSubdominio(dc.subdominio)
        setSubdominioEdit(dc.subdominio)
        setEditandoUrl(false)
      }
      flash('Loja atualizada! ✨', 'ok')
    } catch {
      flash('Erro de conexão', 'erro')
    }
    setSalvando(false)
  }

  const inicial = (nome[0] || '?').toUpperCase()
  const logoMostrar = preview || fotoUrl
  const bannerMostrar = bannerPreview || bannerUrl

  if (loading) {
    return (
      <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--cinza)' }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
      <BannerPagamentoPendente status={statusConta} />
      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)', flex: 1 }}>Personalizar minha loja</div>
        {subdominio && (
          <a
            href={`/loja/${subdominio}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 999,
              background: 'var(--rosa)', color: 'white',
              fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Ver minha loja
          </a>
        )}
      </header>

      {/* Preview */}
      <div style={{ background: fundoValido(corFundo).hex, borderBottom: '1px solid var(--cinza-light)', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          Pré-visualização
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
            background: logoMostrar ? `url(${logoMostrar}) center/cover` : cor,
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22, fontWeight: 700,
          }}>
            {!logoMostrar && inicial}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: fonteValida(fonte).cssFamily, fontSize: 20, fontWeight: 700, color: cor, lineHeight: 1.1 }}>
              {nomeLoja || `Loja da ${nome.split(' ')[0] || ''}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--cinza)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>
              Joias 925
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Escolher destaques da vitrine */}
        <Link href="/configurar-loja/destaques" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26 }}>⭐</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)' }}>Destaques da loja</div>
              <div style={{ fontSize: 12, color: 'var(--cinza)' }}>Escolha as peças em destaque na sua vitrine (ou deixe as nossas)</div>
            </div>
            <div style={{ color: 'var(--cinza)', fontSize: 22 }}>›</div>
          </div>
        </Link>

        {/* Nome da loja */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🏷️ Nome da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>Como aparece para suas clientes.</div>
          <input
            className="input-padrao"
            value={nomeLoja}
            onChange={e => setNomeLoja(e.target.value)}
            placeholder={`Ex: Loja da ${nome.split(' ')[0] || 'Maria'}`}
            maxLength={60}
          />
        </div>

        {/* URL da loja (slug do link) */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🔗 URL da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>
            O endereço que vai aparecer no link que tu compartilha.
          </div>
          {!editandoUrl ? (
            <>
              <div style={{ background: 'var(--off)', border: '1px solid var(--cinza-light)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--texto)', wordBreak: 'break-all', minWidth: 0, flex: 1 }}>
                  {brand.dominio}/loja/<strong style={{ color: 'var(--rosa)' }}>{subdominio || '...'}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoUrl(true)
                    // Sugere slug do nome da loja se URL atual ainda é o auto-gerado feio
                    if (nomeLoja && (!subdominio || subdominio.match(/-\d{4}$/))) {
                      const sug = gerarSlug(nomeLoja)
                      if (sug.length >= 3) setSubdominioEdit(sug)
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid var(--rosa)', color: 'var(--rosa)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ✏️ Mudar
                </button>
              </div>
              {nomeLoja && subdominio && subdominio.match(/-\d{4}$/) && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>
                  💡 Tua URL ainda tá no formato padrão. Clica em <strong>Mudar</strong> pra deixar bonita tipo <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,.05)', padding: '1px 4px', borderRadius: 3 }}>{gerarSlug(nomeLoja)}</code>.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '2px solid var(--rosa)', borderRadius: 10, background: 'white', overflow: 'hidden' }}>
                <span style={{ padding: '12px 4px 12px 12px', fontSize: 12, color: 'var(--cinza)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  …com.br/loja/
                </span>
                <input
                  value={subdominioEdit}
                  onChange={e => setSubdominioEdit(gerarSlug(e.target.value))}
                  placeholder="loja-da-maria"
                  maxLength={30}
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 12px 12px 0', fontSize: 14, fontFamily: 'monospace', minWidth: 0, background: 'transparent' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 6, lineHeight: 1.5 }}>
                3–30 caracteres · só letras (a-z), números e hífens · sem acentos
              </div>
              {nomeLoja && (
                <button
                  type="button"
                  onClick={() => setSubdominioEdit(gerarSlug(nomeLoja))}
                  style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--rosa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  ✨ Usar &ldquo;{gerarSlug(nomeLoja)}&rdquo;
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => { setSubdominioEdit(subdominio || ''); setEditandoUrl(false) }}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--cinza-light)', color: 'var(--cinza)', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <div style={{ flex: 1, fontSize: 11, color: 'var(--cinza)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3 }}>
                  Salva no botão grande embaixo
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#7c2d12', background: '#FFEDD5', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>
                ⚠️ Trocar a URL faz com que qualquer link antigo da tua loja pare de funcionar. Manda a nova pra tuas clientes depois.
              </div>
            </>
          )}
        </div>

        {/* Bio / sobre a loja */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>
            💬 Sobre sua loja <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--cinza)' }}>(opcional)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>Uma frase curta que aparece no banner. Deixa vazio se não quiser mostrar nada.</div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 280))}
            placeholder="Ex: Peças escolhidas com carinho pra mulheres que se amam todos os dias."
            rows={3}
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid var(--cinza-light)',
              borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              background: 'white', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--cinza)', textAlign: 'right', marginTop: 4 }}>{bio.length}/280</div>
        </div>

        {/* Mensagem WhatsApp customizada */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>
            💬 Mensagem do WhatsApp <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--cinza)' }}>(opcional)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12, lineHeight: 1.5 }}>
            Mensagem que a cliente envia pra você ao clicar no botão WhatsApp da loja. Use <code style={{ background: 'var(--rosa-pale)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{'{nome}'}</code> pra incluir teu primeiro nome.
          </div>
          <textarea
            value={whatsappMensagem}
            onChange={e => setWhatsappMensagem(e.target.value.slice(0, 280))}
            placeholder={`Ex: Olá ${nome.split(' ')[0] || '{nome}'}! Vi sua loja e quero saber mais 💎`}
            rows={3}
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid var(--cinza-light)',
              borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              background: 'white', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--cinza)', textAlign: 'right', marginTop: 4 }}>{whatsappMensagem.length}/280</div>
          {/* Preview da mensagem renderizada */}
          {whatsappMensagem.trim() && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#E7FFDB', border: '1px solid #BBE7A8', borderRadius: 10, fontSize: 13, color: '#1A4B0E', lineHeight: 1.4 }}>
              👀 Preview: &ldquo;{whatsappMensagem.replace(/\{nome\}/g, nome.split(' ')[0] || 'Nome')}&rdquo;
            </div>
          )}
        </div>

        {/* Cor */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🎨 Cor da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>Usada no nome, botões e destaques da sua loja.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {TEMAS_LOJA.map(t => {
              const sel = t.cor.toLowerCase() === cor.toLowerCase()
              return (
                <button
                  key={t.cor}
                  type="button"
                  onClick={() => setCor(t.cor)}
                  title={t.nome}
                  style={{
                    border: sel ? '3px solid var(--texto)' : '2px solid var(--cinza-light)',
                    borderRadius: 12, padding: 8, background: 'white', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.cor }} />
                  <span style={{ fontSize: 9.5, color: 'var(--cinza)', lineHeight: 1.2, textAlign: 'center' }}>{t.nome}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Fundo */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🖼️ Fundo da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>Tom de fundo da página da sua loja. Combina com a cor escolhida.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {FUNDOS_LOJA.map(f => {
              const sel = f.id === corFundo
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCorFundo(f.id)}
                  title={f.nome}
                  style={{
                    border: sel ? '3px solid var(--texto)' : '2px solid var(--cinza-light)',
                    borderRadius: 12, padding: 8, background: 'white', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{ width: '100%', height: 34, borderRadius: 8, background: f.hex, border: '1px solid var(--cinza-light)' }} />
                  <span style={{ fontSize: 9.5, color: 'var(--cinza)', lineHeight: 1.2, textAlign: 'center' }}>{f.nome}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Banner / capa */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🎬 Banner da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>O fundo animado do topo da sua loja. Se você enviar uma foto de banner, ela tem prioridade.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {BANNERS_LOJA.map(b => {
              const sel = b.id === bannerPreset
              const bg = b.css || `linear-gradient(135deg, ${cor}, ${cor})`
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBannerPreset(b.id)}
                  title={b.nome}
                  style={{
                    border: sel ? `3px solid ${cor}` : '2px solid var(--cinza-light)',
                    borderRadius: 12, padding: 6, background: 'white', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ width: '100%', height: 54, borderRadius: 8, background: bg, backgroundSize: '160% 160%' }} />
                  <span style={{ fontSize: 10.5, color: 'var(--cinza)', textAlign: 'center', fontWeight: sel ? 700 : 500 }}>{b.nome}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Opções do banner */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 12 }}>🎚️ Opções do banner</div>
          {[
            { label: 'Mostrar texto sobre o banner', sub: 'O título "Joias que contam histórias suas" + sua bio.', v: mostrarTexto, set: setMostrarTexto },
            { label: 'Escurecer a foto do banner', sub: 'Só vale se você enviou uma foto. Desligue pra mostrá-la limpa.', v: bannerOverlay, set: setBannerOverlay },
          ].map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => t.set(!t.v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                border: '1px solid var(--cinza-light)', background: 'white', cursor: 'pointer',
                marginBottom: i === 0 ? 10 : 0, textAlign: 'left',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 2, lineHeight: 1.3 }}>{t.sub}</div>
              </div>
              <span style={{
                flexShrink: 0, width: 40, height: 22, borderRadius: 12, position: 'relative',
                background: t.v ? cor : '#D5D5D5', transition: 'background .2s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: t.v ? 20 : 2, width: 18, height: 18,
                  borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                }} />
              </span>
            </button>
          ))}
        </div>

        {/* Cor do texto sobre o banner */}
        {mostrarTexto && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🅰️ Cor do texto sobre o banner</div>
            <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>O título e a bio que aparecem no banner. Combine com a cor do banner pra ficar legível.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {HERO_TEXTO_CORES.map(c => {
                const sel = c.id === heroTextoCor
                const hexReal = heroTextoHexReal(c.id, cor)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setHeroTextoCor(c.id)}
                    title={c.nome}
                    style={{
                      border: sel ? '3px solid var(--texto)' : '2px solid var(--cinza-light)',
                      borderRadius: 12, padding: 6, background: '#1A1A1A', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontWeight: 700, fontSize: 22, lineHeight: 1,
                      color: hexReal,
                    }}>Aa</span>
                    <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.8)', textAlign: 'center', fontWeight: sel ? 700 : 500 }}>
                      {c.nome}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Texto editável do banner (título + subtítulo em itálico) */}
        {mostrarTexto && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>✏️ Texto do banner</div>
            <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>Personalize as 2 linhas que aparecem no banner. Deixa vazio pra usar o padrão.</div>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700, marginBottom: 4 }}>
              Linha 1 (título)
            </label>
            <input
              className="input-padrao"
              value={heroTitulo}
              onChange={e => setHeroTitulo(e.target.value.slice(0, 80))}
              placeholder="Joias que contam"
              maxLength={80}
              style={{ marginBottom: 4 }}
            />
            <div style={{ fontSize: 10, color: 'var(--cinza)', textAlign: 'right', marginBottom: 12 }}>{heroTitulo.length}/80</div>

            <label style={{ display: 'block', fontSize: 11, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700, marginBottom: 4 }}>
              Linha 2 (em itálico)
            </label>
            <input
              className="input-padrao"
              value={heroSubtitulo}
              onChange={e => setHeroSubtitulo(e.target.value.slice(0, 80))}
              placeholder="histórias suas"
              maxLength={80}
              style={{ marginBottom: 4, fontStyle: 'italic' }}
            />
            <div style={{ fontSize: 10, color: 'var(--cinza)', textAlign: 'right', marginBottom: 12 }}>{heroSubtitulo.length}/80</div>

            {/* Preview rápido */}
            <div style={{ background: cor, borderRadius: 10, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: fonte, fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.15, letterSpacing: -.5 }}>
                {heroTitulo.trim() || 'Joias que contam'}
                {(heroSubtitulo.trim() || !heroTitulo.trim()) && <br />}
                {(heroSubtitulo.trim() || (!heroTitulo.trim() && !heroSubtitulo.trim())) && (
                  <em style={{ opacity: .86 }}>{heroSubtitulo.trim() || 'histórias suas'}</em>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--cinza)', textAlign: 'center', marginTop: 6 }}>
              ↑ Pré-visualização (aproximada)
            </div>
          </div>
        )}

        {/* Blocos opcionais do storefront — escolhe quais quer mostrar */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>✨ Blocos da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>
            Escolhe quais blocos extras aparecem na tua loja pra elevar a percepção das peças.
          </div>
          {([
            {
              label: 'Por que Prata 925?',
              sub: '3 cards explicando os benefícios do material (legítima, hipoalergênica, brilho duradouro).',
              v: blocoPrata925, set: setBlocoPrata925,
            },
            {
              label: 'Depoimentos de clientes',
              sub: '3 depoimentos com 5 estrelas que aumentam a confiança pra primeira compra.',
              v: blocoDepoimentos, set: setBlocoDepoimentos,
            },
            {
              label: 'Selos de garantia',
              sub: 'Barra com 3 selos no rodapé: embalagem especial, envio rápido e pagamento seguro.',
              v: blocoGarantias, set: setBlocoGarantias,
            },
          ] as { label: string; sub: string; v: boolean; set: (b: boolean) => void }[]).map((t, i, arr) => (
            <button
              key={i}
              type="button"
              onClick={() => t.set(!t.v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                border: '1px solid var(--cinza-light)', background: 'white', cursor: 'pointer',
                marginBottom: i === arr.length - 1 ? 0 : 10, textAlign: 'left',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 2, lineHeight: 1.3 }}>{t.sub}</div>
              </div>
              <span style={{
                flexShrink: 0, width: 40, height: 22, borderRadius: 12, position: 'relative',
                background: t.v ? cor : '#D5D5D5', transition: 'background .2s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: t.v ? 20 : 2, width: 18, height: 18,
                  borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                }} />
              </span>
            </button>
          ))}
        </div>

        {/* Cor da cinta de avisos */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>📣 Cor da cinta de avisos</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>A barra animada do topo (frete grátis, 6x, etc). A fonte segue a tipografia da loja.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {TEMAS_LOJA.map(t => {
              const sel = t.cor.toLowerCase() === cintaCor.toLowerCase()
              return (
                <button
                  key={t.cor}
                  type="button"
                  onClick={() => setCintaCor(t.cor)}
                  title={t.nome}
                  style={{
                    border: sel ? '3px solid var(--texto)' : '2px solid var(--cinza-light)',
                    borderRadius: 12, padding: 8, background: 'white', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.cor }} />
                  <span style={{ fontSize: 9.5, color: 'var(--cinza)', lineHeight: 1.2, textAlign: 'center' }}>{t.nome}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Vídeo da loja (opcional) */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🎥 Vídeo da loja (opcional)</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>Cole um link do YouTube ou de um vídeo (.mp4). Aparece na sua loja entre as categorias. Deixe vazio para não mostrar.</div>
          <input
            type="url"
            inputMode="url"
            placeholder="https://youtube.com/watch?v=... ou https://.../video.mp4"
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', border: '2px solid var(--cinza-light)', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Fonte */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>✍️ Tipografia da loja</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 14 }}>Aplicada no nome da loja e nos títulos das seções.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {FONTES_LOJA.map(f => {
              const sel = f.id === fonte
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFonte(f.id)}
                  style={{
                    border: sel ? `2px solid ${cor}` : '2px solid var(--cinza-light)',
                    borderRadius: 12, padding: '12px 14px', background: sel ? 'var(--rosa-pale)' : 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: f.cssFamily, fontSize: 18, fontWeight: 700, color: 'var(--texto)', marginBottom: 2, lineHeight: 1.2 }}>
                      {nomeLoja || `Loja da ${nome.split(' ')[0] || 'você'}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                      <strong style={{ color: 'var(--texto)' }}>{f.nome}</strong> · {f.descricao}
                    </div>
                  </div>
                  {sel && (
                    <span aria-hidden style={{ color: cor, fontSize: 18, fontWeight: 800, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Logo */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>🖼️ Logo (opcional)</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.6, marginBottom: 14 }}>
            Quadrado, ideal <strong>400×400px</strong> (mín. 200×200). PNG, JPG ou WEBP, até 3MB.
            Aparece em <strong>círculo</strong> — centralize o conteúdo.
            Sem logo, mostramos a inicial <strong>{inicial}</strong> na cor da loja.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: logoMostrar ? `url(${logoMostrar}) center/cover` : cor,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700,
              border: '1px solid var(--cinza-light)',
            }}>
              {!logoMostrar && inicial}
            </div>
            <div style={{ flex: 1 }}>
              <label className="btn-teal" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', fontSize: 13, padding: 12 }}>
                {logoMostrar ? 'Trocar logo' : 'Escolher imagem'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onArquivo} style={{ display: 'none' }} />
              </label>
              {(preview || fotoUrl) && (
                <button
                  type="button"
                  onClick={() => { setArquivo(null); setPreview(null); setFotoUrl(null) }}
                  style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--cinza)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remover logo (usar a inicial)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>📸 Banner da loja (opcional)</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.6, marginBottom: 14 }}>
            Imagem de fundo no topo da sua loja. Ideal <strong>1600×600px</strong> (paisagem),
            PNG/JPG/WEBP até 5MB. Sem banner, usamos uma foto bonita de joia automaticamente.
          </div>
          <div style={{
            position: 'relative', width: '100%', paddingTop: '37.5%',
            borderRadius: 12, overflow: 'hidden', marginBottom: 12,
            background: bannerMostrar ? `url(${bannerMostrar}) center/cover` : 'linear-gradient(135deg, #F5F1E8 0%, #FAF6EE 100%)',
            border: '1px solid var(--cinza-light)',
          }}>
            {!bannerMostrar && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza)', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: 20 }}>
                Sem banner próprio<br/><span style={{ fontSize: 10, fontWeight: 500 }}>(usaremos uma joia em destaque)</span>
              </div>
            )}
          </div>
          <label className="btn-teal" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', fontSize: 13, padding: 12 }}>
            {bannerMostrar ? 'Trocar banner' : 'Escolher banner'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onBannerArquivo} style={{ display: 'none' }} />
          </label>
          {bannerMostrar && (
            <button
              type="button"
              onClick={removerBanner}
              style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--cinza)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Remover banner (usar foto automática)
            </button>
          )}
        </div>

        {/* Redes sociais */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>📱 Suas redes sociais (opcional)</div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.6, marginBottom: 14 }}>
            Aparecem como botões na sua loja. Coloca só o nome de usuário (sem @ nem link).
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              Instagram
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--cinza-light)', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
              <span style={{ padding: '12px 12px', fontSize: 14, color: 'var(--cinza)', borderRight: '1px solid var(--cinza-light)', fontFamily: 'inherit' }}>@</span>
              <input
                value={instagram}
                onChange={e => setInstagram(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase().slice(0, 40))}
                placeholder="seu_usuario"
                style={{ flex: 1, padding: '12px 14px', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>
          </label>

          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#000" stroke="none"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              TikTok
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--cinza-light)', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
              <span style={{ padding: '12px 12px', fontSize: 14, color: 'var(--cinza)', borderRight: '1px solid var(--cinza-light)', fontFamily: 'inherit' }}>@</span>
              <input
                value={tiktok}
                onChange={e => setTiktok(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase().slice(0, 40))}
                placeholder="seu_usuario"
                style={{ flex: 1, padding: '12px 14px', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>
          </label>
        </div>

        <button
          onClick={salvar}
          disabled={salvando}
          className="btn-rosa"
          style={{ marginBottom: 10, opacity: salvando ? 0.6 : 1 }}
        >
          {salvando ? 'Salvando...' : '💾 Salvar minha loja'}
        </button>
        {/* Atalho pra abrir a vitrine pública em nova aba — assim a
            revendedora vê o resultado depois de salvar sem ter que
            voltar pro topo da página. Mesmo do botão no header. */}
        {subdominio && (
          <a
            href={`/loja/${subdominio}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: 14, borderRadius: 14,
              background: 'white', border: '1.5px solid var(--rosa)',
              color: 'var(--rosa)', fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', boxSizing: 'border-box', marginBottom: 10,
              textTransform: 'uppercase', letterSpacing: .5,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Ver minha loja
          </a>
        )}
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--cinza)', padding: '4px 0 8px' }}>
          As mudanças aparecem na sua loja na hora.
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: toast.tipo === 'ok' ? 'var(--teal-dark)' : '#A32D2D',
          color: 'white', padding: '12px 22px', borderRadius: 12, fontSize: 14,
          fontWeight: 700, fontFamily: 'Montserrat', boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        }}>
          {toast.msg}
        </div>
      )}

      <BottomNav ativa="loja" />

      {cropSrc && (
        <CropperModal
          src={cropSrc.src}
          aspect={cropSrc.tipo === 'logo' ? 1 : 16 / 9}
          maxSize={cropSrc.tipo === 'logo' ? 800 : 1600}
          titulo={cropSrc.tipo === 'logo' ? 'Recortar logo' : 'Recortar banner'}
          onCancelar={() => {
            URL.revokeObjectURL(cropSrc.src)
            setCropSrc(null)
          }}
          onConfirmar={aplicarRecorte}
        />
      )}
    </div>
  )
}
