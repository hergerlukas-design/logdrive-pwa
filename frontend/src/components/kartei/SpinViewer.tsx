import { useEffect, useMemo, useRef } from 'react'
import type { BodyType } from '../../lib/database.types'
import { HOTSPOT_LABEL, type HotspotId, type Level } from '../../lib/kartei'
import { CAR_SPECS, projectSpinMarkers } from './carSpecs'

export interface SpinViewerProps {
  frames:      string[]
  bodyType:    BodyType
  frontFrame:  number
  reverse:     boolean
  aspect:      number
  active?:     HotspotId | null
  levels?:     Partial<Record<HotspotId, Level>>
  onSelect?:   (id: HotspotId) => void
  showMarkers?: boolean
  /** Beim Start einmal langsam drehen, bis jemand wischt */
  autoSpin?:   boolean
  /** Wird bei jedem Bildwechsel aufgerufen (z. B. für die Front-Auswahl in der Vorschau) */
  onFrame?:    (index: number) => void
  /** Von außen auf ein Foto springen */
  goTo?:       number | null
}

const mod = (n: number, m: number) => ((n % m) + m) % m

/** Bildposition (Anteil) → Pixel im Container bei object-fit: cover */
function coverMap(cw: number, ch: number, aspect: number) {
  let w = cw, h = cw / aspect
  if (h < ch) { h = ch; w = ch * aspect }
  const ox = (cw - w) / 2, oy = (ch - h) / 2
  return (u: number, v: number) => [ox + u * w, oy + v * h] as const
}

/** Element direkt verschieben – läuft pro Bildwechsel, außerhalb des React-Renderings */
function placeMarker(el: HTMLElement, x: number, y: number, opacity: number) {
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
  el.style.opacity = String(opacity)
  el.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none'
}

export function SpinViewer({
  frames, bodyType, frontFrame, reverse, aspect, active = null, levels, onSelect,
  showMarkers = true, autoSpin = true, onFrame, goTo = null,
}: SpinViewerProps) {
  const n          = frames.length
  const boxRef     = useRef<HTMLDivElement>(null)
  const imgRef     = useRef<HTMLImageElement>(null)
  const markerRefs = useRef<Partial<Record<HotspotId, HTMLButtonElement | null>>>({})
  const markers    = useMemo(
    () => projectSpinMarkers(CAR_SPECS[bodyType], n, frontFrame, reverse, aspect),
    [bodyType, n, frontFrame, reverse, aspect],
  )

  // Animationszustand in einem Ref, damit Wischen keine React-Renders auslöst
  const st = useRef({
    pos: frontFrame + Math.round(n / 8) * (reverse ? -1 : 1), // Start in ¾-Ansicht
    shown: -1, vel: 0, dragging: false, lastX: 0, lastT: 0,
    auto: autoSpin, target: null as number | null, raf: 0, lastFrame: 0,
  })
  const propsRef = useRef({ markers, showMarkers, onFrame, frames })
  useEffect(() => { propsRef.current = { markers, showMarkers, onFrame, frames } })

  // Alle Fotos vorab dekodieren, damit das Drehen ruckelfrei ist
  useEffect(() => {
    frames.forEach(src => { const im = new Image(); im.src = src; im.decode?.().catch(() => undefined) })
  }, [frames])

  useEffect(() => {
    const s = st.current
    const draw = (force = false) => {
      const { markers, showMarkers, onFrame, frames } = propsRef.current
      const idx = mod(Math.round(s.pos), frames.length)
      const box = boxRef.current, img = imgRef.current
      if (!box || !img) return
      if (idx !== s.shown || force) {
        img.src = frames[idx]
        s.shown = idx
        onFrame?.(idx)
      }
      const map = coverMap(box.clientWidth, box.clientHeight, aspect)
      for (const m of markers[idx] ?? []) {
        const el = markerRefs.current[m.id]
        if (!el) continue
        const [x, y] = map(m.u, m.v)
        placeMarker(el, x, y, showMarkers ? m.visible : 0)
      }
    }

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - (s.lastFrame || t)) / 1000)
      s.lastFrame = t
      if (!s.dragging) {
        if (s.target !== null) {
          const diff = s.target - s.pos
          s.pos += diff * Math.min(1, dt * 7)
          if (Math.abs(diff) < 0.05) { s.pos = s.target; s.target = null }
        } else if (Math.abs(s.vel) > 0.05) {
          s.pos += s.vel * dt
          s.vel *= Math.exp(-dt * 3.2)
        } else if (s.auto) {
          s.pos += dt * (n / 14) // eine Umdrehung in ~14 s
        }
      }
      draw()
      s.raf = requestAnimationFrame(tick)
    }
    draw(true)
    s.raf = requestAnimationFrame(tick)
    const onResize = () => draw(true)
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(s.raf); window.removeEventListener('resize', onResize) }
  }, [n, aspect])

  // Neu zeichnen, wenn sich Markierungen/Einstellungen ändern
  useEffect(() => { st.current.shown = -1 }, [markers, showMarkers, frames])

  // Bei Auswahl eines Punkts zur Ansicht drehen, in der er am besten sichtbar ist
  useEffect(() => {
    if (!active) return
    const s = st.current
    const cur = mod(Math.round(s.pos), n)
    let best = cur, bestScore = -1
    for (let i = 0; i < n; i++) {
      const vis = markers[i].find(m => m.id === active)?.visible ?? 0
      const dist = Math.min(mod(i - cur, n), mod(cur - i, n))
      const score = vis - dist * 0.01
      if (score > bestScore) { bestScore = score; best = i }
    }
    const forward = mod(best - cur, n), backward = mod(cur - best, n)
    s.auto = false; s.vel = 0
    s.target = Math.round(s.pos) + (forward <= backward ? forward : -backward)
  }, [active, markers, n])

  useEffect(() => {
    if (goTo === null) return
    const s = st.current
    const cur = mod(Math.round(s.pos), n)
    const forward = mod(goTo - cur, n), backward = mod(cur - goTo, n)
    s.auto = false; s.vel = 0
    s.target = Math.round(s.pos) + (forward <= backward ? forward : -backward)
  }, [goTo, n])

  const pxPerFrame = () => ((boxRef.current?.clientWidth ?? 360) * 1.5) / n

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const s = st.current
    s.dragging = true; s.auto = false; s.target = null; s.vel = 0
    s.lastX = e.clientX; s.lastT = e.timeStamp
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current
    if (!s.dragging) return
    const dx = e.clientX - s.lastX
    const dt = Math.max(1, e.timeStamp - s.lastT) / 1000
    const df = -dx / pxPerFrame()
    s.pos += df
    s.vel = s.vel * 0.6 + (df / dt) * 0.4
    s.lastX = e.clientX; s.lastT = e.timeStamp
  }
  const onPointerUp = () => {
    const s = st.current
    s.dragging = false
    s.vel = Math.max(-n * 1.5, Math.min(n * 1.5, s.vel))
  }

  return (
    <div ref={boxRef} className="qc-spin"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <img ref={imgRef} alt="360°-Ansicht des Fahrzeugs" draggable={false} />
      {(Object.keys(HOTSPOT_LABEL) as HotspotId[]).map(id => (
        <button key={id} ref={el => { markerRefs.current[id] = el }} type="button"
          aria-label={HOTSPOT_LABEL[id]} title={HOTSPOT_LABEL[id]}
          onClick={() => onSelect?.(id)}
          className={['qc-hotspot', active === id ? 'is-active' : '', `lvl-${levels?.[id] ?? 'none'}`].join(' ')}
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}>
          <span />
        </button>
      ))}
    </div>
  )
}
