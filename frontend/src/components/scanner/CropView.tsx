import { useState, useRef, useCallback, useEffect } from 'react'

interface Crop { x: number; y: number; w: number; h: number }
interface ImgRect { left: number; top: number; width: number; height: number }

interface Props {
  imageDataUrl: string
  onCrop:       (croppedDataUrl: string) => void
  onBack:       () => void
}

export default function CropView({ imageDataUrl, onCrop, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef       = useRef<HTMLImageElement>(null)
  const dragging     = useRef<{ corner: string; startX: number; startY: number; startCrop: Crop } | null>(null)

  const [crop,    setCrop]    = useState<Crop>({ x: 0.05, y: 0.05, w: 0.90, h: 0.90 })
  const [imgRect, setImgRect] = useState<ImgRect | null>(null)

  const calcImgRect = useCallback(() => {
    const img       = imgRef.current
    const container = containerRef.current
    if (!img || !container) return
    const cw = container.clientWidth, ch = container.clientHeight
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
    setImgRect({ left: (cw - dw) / 2, top: (ch - dh) / 2, width: dw, height: dh })
  }, [])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (img.complete) calcImgRect()
    img.addEventListener('load', calcImgRect)
    window.addEventListener('resize', calcImgRect)
    return () => { img.removeEventListener('load', calcImgRect); window.removeEventListener('resize', calcImgRect) }
  }, [calcImgRect])

  const handlePointerDown = useCallback((corner: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = { corner, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } }
  }, [crop])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !imgRect) return
    const { corner, startX, startY, startCrop } = dragging.current
    const dx = (e.clientX - startX) / imgRect.width
    const dy = (e.clientY - startY) / imgRect.height
    const MIN = 0.1
    let { x, y, w, h } = startCrop
    if (corner === 'tl') {
      const nx = Math.min(x+w-MIN, Math.max(0,x+dx)), ny = Math.min(y+h-MIN, Math.max(0,y+dy))
      w = w+(x-nx); h = h+(y-ny); x = nx; y = ny
    } else if (corner === 'tr') {
      const ny = Math.min(y+h-MIN, Math.max(0,y+dy))
      w = Math.max(MIN, Math.min(1-x, w+dx)); h = h+(y-ny); y = ny
    } else if (corner === 'bl') {
      const nx = Math.min(x+w-MIN, Math.max(0,x+dx))
      w = w+(x-nx); x = nx; h = Math.max(MIN, Math.min(1-y, h+dy))
    } else if (corner === 'br') {
      w = Math.max(MIN, Math.min(1-x, w+dx)); h = Math.max(MIN, Math.min(1-y, h+dy))
    }
    setCrop({ x, y, w, h })
  }, [imgRect])

  const handlePointerUp = useCallback(() => { dragging.current = null }, [])

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const iw = img.naturalWidth, ih = img.naturalHeight
    const px = Math.round(crop.x*iw), py = Math.round(crop.y*ih)
    const pw = Math.round(crop.w*iw), ph = Math.round(crop.h*ih)
    const canvas = document.createElement('canvas')
    canvas.width = pw; canvas.height = ph
    canvas.getContext('2d')!.drawImage(img, px, py, pw, ph, 0, 0, pw, ph)
    onCrop(canvas.toDataURL('image/jpeg', 0.92))
  }, [crop, onCrop])

  const boxStyle = imgRect ? {
    left:   imgRect.left + crop.x * imgRect.width,
    top:    imgRect.top  + crop.y * imgRect.height,
    width:  crop.w * imgRect.width,
    height: crop.h * imgRect.height,
  } : null

  return (
    <div className="flex flex-col h-full bg-black"
      onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>

      <div className="flex items-center justify-between px-5 py-3 safe-top shrink-0">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">Zuschneiden</span>
        <div className="w-9" />
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ touchAction: 'none' }}>
        <img ref={imgRef} src={imageDataUrl} alt="Zuschneiden"
          className="absolute inset-0 w-full h-full object-contain" onLoad={calcImgRect} draggable={false} />

        {imgRect && boxStyle && (
          <>
            {/* Abgedunkelte Bereiche */}
            <div className="absolute bg-black/60 pointer-events-none"
              style={{ left: imgRect.left, top: imgRect.top, width: imgRect.width, height: crop.y * imgRect.height }} />
            <div className="absolute bg-black/60 pointer-events-none"
              style={{ left: imgRect.left, top: imgRect.top + (crop.y+crop.h)*imgRect.height, width: imgRect.width, height: (1-crop.y-crop.h)*imgRect.height }} />
            <div className="absolute bg-black/60 pointer-events-none"
              style={{ left: imgRect.left, top: imgRect.top+crop.y*imgRect.height, width: crop.x*imgRect.width, height: crop.h*imgRect.height }} />
            <div className="absolute bg-black/60 pointer-events-none"
              style={{ left: imgRect.left+(crop.x+crop.w)*imgRect.width, top: imgRect.top+crop.y*imgRect.height, width: (1-crop.x-crop.w)*imgRect.width, height: crop.h*imgRect.height }} />

            {/* Rahmen */}
            <div className="absolute border-2 border-white pointer-events-none"
              style={{ left: boxStyle.left, top: boxStyle.top, width: boxStyle.width, height: boxStyle.height }} />

            {/* Eck-Griffe */}
            {([
              { corner: 'tl', style: { left: boxStyle.left-14,                     top: boxStyle.top-14 } },
              { corner: 'tr', style: { left: boxStyle.left+boxStyle.width-14,       top: boxStyle.top-14 } },
              { corner: 'bl', style: { left: boxStyle.left-14,                     top: boxStyle.top+boxStyle.height-14 } },
              { corner: 'br', style: { left: boxStyle.left+boxStyle.width-14,       top: boxStyle.top+boxStyle.height-14 } },
            ]).map(({ corner, style }) => (
              <div key={corner} style={{ ...style, position: 'absolute', width: 28, height: 28, touchAction: 'none' }}
                className="bg-white rounded-sm border-2 border-brand-600 shadow-lg"
                onPointerDown={e => handlePointerDown(corner, e)} />
            ))}
          </>
        )}
      </div>

      <div className="px-5 pt-4 pb-8 shrink-0 flex gap-3">
        <button onClick={() => setCrop({ x: 0.05, y: 0.05, w: 0.90, h: 0.90 })}
          className="flex-1 py-3 border-2 border-white/30 text-white rounded-2xl font-semibold text-sm active:scale-95 transition-transform">
          Zurücksetzen
        </button>
        <button onClick={handleConfirm}
          className="flex-1 py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform">
          Bestätigen ✓
        </button>
      </div>
    </div>
  )
}
