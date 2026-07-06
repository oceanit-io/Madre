'use client'
import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

type Props = {
  src: string                // object URL da imagem escolhida
  aspect: number             // ex: 1 (logo), 16/9 (banner)
  maxSize: number            // dimensão máx do lado maior na saída (px)
  titulo: string             // título do modal
  onCancelar: () => void
  onConfirmar: (blob: Blob) => void
}

// Extrai o recorte (em pixels da imagem original) para um Blob JPEG comprimido.
// maxSize limita o lado maior — evita uploads gigantes.
async function getCroppedBlob(src: string, area: Area, maxSize: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
  let outW = area.width
  let outH = area.height
  const maior = Math.max(outW, outH)
  if (maior > maxSize) {
    const k = maxSize / maior
    outW = Math.round(outW * k)
    outH = Math.round(outH * k)
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, outW)
  canvas.height = Math.max(1, outH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.9)
  })
}

export default function CropperModal({ src, aspect, maxSize, titulo, onCancelar, onConfirmar }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [proc, setProc] = useState(false)

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setArea(areaPixels)
  }, [])

  async function confirmar() {
    if (!area || proc) return
    setProc(true)
    try {
      const blob = await getCroppedBlob(src, area, maxSize)
      onConfirmar(blob)
    } catch {
      setProc(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px', color: '#fff', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{titulo}</span>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cancelar"
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: 6 }}
        >
          ×
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          showGrid
        />
      </div>

      <div style={{ padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: '#777', fontWeight: 700, minWidth: 50, textTransform: 'uppercase', letterSpacing: 1 }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#1A1A1A' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #DDD', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#555' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={proc}
            style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: proc ? '#888' : '#1A1A1A', color: '#fff', cursor: proc ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
          >
            {proc ? 'Processando…' : 'Salvar recorte'}
          </button>
        </div>
      </div>
    </div>
  )
}
