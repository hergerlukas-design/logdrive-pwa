import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Camera, Images, Undo2, RotateCcw, Check, Trash2, Eye, EyeOff, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCamera } from '../hooks/useCamera'
import { SPIN_ASPECT, encodeFrame, encodeFile, uploadSpin, deleteSpin } from '../lib/spin'
import type { Vehicle, VehicleSpin } from '../lib/kartei'
import { SpinViewer } from '../components/kartei/SpinViewer'
import '../components/kartei/kartei.css'

type Step = 'intro' | 'capture' | 'review' | 'upload'

// ═════════════════════════════════════════════════════════════════════════
// Positionsanzeige: Draufsicht mit Kreis aus Aufnahme-Punkten
// ═════════════════════════════════════════════════════════════════════════

function OrbitGuide({ total, done }: { total: number; done: number }) {
  const r = 46
  // Start vorne (oben), dann im Uhrzeigersinn zur rechten Fahrzeugseite
  const pt = (i: number) => {
    const a = -Math.PI / 2 + (i / total) * Math.PI * 2
    return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r] as const
  }
  const [cx, cy] = pt(Math.min(done, total - 1))
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24 shrink-0" aria-hidden>
      <rect x="47" y="28" width="26" height="64" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <rect x="51" y="38" width="18" height="12" rx="3" fill="rgba(255,255,255,0.35)" />
      <path d="M60 20 l-5 6 h10 z" fill="#fff" />
      {Array.from({ length: total }, (_, i) => {
        const [x, y] = pt(i)
        return <circle key={i} cx={x} cy={y} r={2.6} fill={i < done ? '#22c55e' : 'rgba(255,255,255,0.35)'} />
      })}
      {done < total && <circle cx={cx} cy={cy} r={6} fill="none" stroke="#fff" strokeWidth="2.5" />}
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Kamera-Schritt
// ═════════════════════════════════════════════════════════════════════════

function CaptureStep({ total, frames, onAdd, onUndo, onDone, onBack }: {
  total: number; frames: string[]; onAdd: (blob: Blob) => void; onUndo: () => void; onDone: () => void; onBack: () => void
}) {
  const { videoRef, isReady, error } = useCamera()
  const [flash, setFlash] = useState(false)
  const [busy, setBusy]   = useState(false)
  const done = frames.length
  const last = frames[frames.length - 1]

  const shoot = async () => {
    const video = videoRef.current
    if (!video || !isReady || busy) return
    setBusy(true)
    setFlash(true); window.setTimeout(() => setFlash(false), 120)
    try {
      navigator.vibrate?.(15)
      onAdd(await encodeFrame(video, video.videoWidth, video.videoHeight))
    } finally { setBusy(false) }
  }

  useEffect(() => { if (done >= total) onDone() }, [done, total, onDone])

  const hint = done === 0
    ? 'Stell dich mittig vor die Front. Das Auto füllt den Rahmen zwischen den Ecken.'
    : `Geh ein Stück weiter zur rechten Seite (≈ ${Math.round(360 / total)}°), Abstand gleich halten.`

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onBack} aria-label="Zurück" className="w-9 h-9 rounded-full bg-white/15 grid place-items-center">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-bold">Foto {Math.min(done + 1, total)} von {total}</span>
        <div className="w-9" />
      </div>

      {/* Bildausschnitt = exakt das gespeicherte 4:3-Foto */}
      <div className="relative w-full bg-neutral-900 overflow-hidden" style={{ aspectRatio: String(SPIN_ASPECT) }}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {last && <img src={last} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />}
        {/* Rahmen: Seitenansicht soll ~80 % der Breite füllen */}
        <div className="absolute pointer-events-none" style={{ left: '10%', right: '10%', top: '20%', bottom: '16%' }}>
          {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2']
            .map(c => <span key={c} className={`absolute w-6 h-6 border-white/90 ${c}`} />)}
        </div>
        <div className="absolute left-1/2 top-[52%] w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <span className="absolute left-1/2 top-0 bottom-0 w-px bg-white/70" />
          <span className="absolute top-1/2 left-0 right-0 h-px bg-white/70" />
        </div>
        {flash && <div className="absolute inset-0 bg-white/80" />}
        {!isReady && !error && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm">{error}</div>}
      </div>

      <div className="flex-1 flex flex-col justify-between px-5 py-4">
        <div className="flex items-center gap-4">
          <OrbitGuide total={total} done={done} />
          <p className="text-sm text-white/85 leading-snug">{hint}</p>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onUndo} disabled={done === 0} aria-label="Letztes Foto verwerfen"
            className="w-12 h-12 rounded-full bg-white/15 grid place-items-center disabled:opacity-30">
            <Undo2 size={20} />
          </button>
          <button onClick={shoot} disabled={!isReady || busy} aria-label="Foto aufnehmen"
            className="w-20 h-20 rounded-full border-4 border-white grid place-items-center active:scale-95 transition-transform disabled:opacity-50">
            <span className="w-16 h-16 rounded-full bg-white" />
          </button>
          <button onClick={onDone} disabled={done < 8} aria-label="Fertig"
            className="w-12 h-12 rounded-full bg-white/15 grid place-items-center disabled:opacity-30">
            <Check size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Seite
// ═════════════════════════════════════════════════════════════════════════

export const SpinCapture: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const back = useCallback(() => navigate(`/fahrzeuge/${vehicleId}`), [navigate, vehicleId])

  const [vehicle, setVehicle]   = useState<Vehicle | null>(null)
  const [spin, setSpin]         = useState<VehicleSpin | null>(null)
  const [allowed, setAllowed]   = useState<boolean | null>(null)
  const [step, setStep]         = useState<Step>('intro')
  const [total, setTotal]       = useState(24)
  const [blobs, setBlobs]       = useState<Blob[]>([])
  const [front, setFront]       = useState(0)
  const [reverse, setReverse]   = useState(false)
  const [markers, setMarkers]   = useState(true)
  const [current, setCurrent]   = useState(0)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [goTo, setGoTo]         = useState<number | null>(null)

  useEffect(() => {
    if (!vehicleId || !user) return
    let cancelled = false
    Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).maybeSingle(),
      supabase.from('vehicle_members').select('*').eq('vehicle_id', vehicleId).eq('user_id', user.id).maybeSingle(),
      supabase.from('vehicle_spins').select('*').eq('vehicle_id', vehicleId).maybeSingle(),
    ]).then(([v, m, s]) => {
      if (cancelled) return
      setVehicle(v.data)
      setSpin(s.data)
      setAllowed(!!v.data && (v.data.user_id === user.id || !!m.data?.editable_sections.includes('fotos')))
    })
    return () => { cancelled = true }
  }, [vehicleId, user])

  // Object-URLs für Vorschau/Zwiebelhaut
  const urls = useMemo(() => blobs.map(b => URL.createObjectURL(b)), [blobs])
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls])

  const add  = useCallback((b: Blob) => setBlobs(list => [...list, b]), [])
  const undo = useCallback(() => setBlobs(list => list.slice(0, -1)), [])
  const finishCapture = useCallback(() => { setFront(0); setReverse(false); setStep('review') }, [])

  const importFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.lastModified - b.lastModified)
    e.target.value = ''
    if (files.length < 8) { setError('Bitte mindestens 8 Fotos auswählen (empfohlen 24–36).'); return }
    if (files.length > 72) { setError('Maximal 72 Fotos.'); return }
    setError(null)
    setProgress([0, files.length])
    try {
      const out: Blob[] = []
      for (const f of files) { out.push(await encodeFile(f)); setProgress([out.length, files.length]) }
      setBlobs(out); setFront(0); setReverse(false); setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setProgress(null) }
  }

  const save = async () => {
    if (!vehicleId) return
    setStep('upload'); setError(null)
    try {
      await uploadSpin({ vehicleId, frames: blobs, frontFrame: front, reverse, onProgress: (d, t) => setProgress([d, t]) })
      back()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('review')
    } finally { setProgress(null) }
  }

  const removeExisting = async () => {
    if (!spin || !confirm('Die vorhandenen 360°-Fotos wirklich löschen?')) return
    try { await deleteSpin(spin); setSpin(null) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }

  if (allowed === null) {
    return <div className="h-dvh grid place-items-center bg-gray-50"><div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!allowed || !vehicle) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-gray-50">
        <p className="text-gray-700">Du darfst für dieses Fahrzeug keine Fotos hinterlegen. Der Besitzer kann dir den Abschnitt „360°-Fotos“ freigeben.</p>
        <button onClick={back} className="px-5 py-3 rounded-2xl bg-brand-700 text-white font-bold">Zurück zur Kartei</button>
      </div>
    )
  }

  if (step === 'capture') {
    return <CaptureStep total={total} frames={urls} onAdd={add} onUndo={undo} onDone={finishCapture} onBack={() => setStep('intro')} />
  }

  const header = (title: string, onBack: () => void) => (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
      <button onClick={onBack} aria-label="Zurück" className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 grid place-items-center">
        <ChevronLeft size={20} strokeWidth={2.5} />
      </button>
      <span className="font-bold text-gray-900">{title}</span>
      <div className="w-9" />
    </div>
  )

  if (step === 'review' || step === 'upload') {
    const uploading = step === 'upload'
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col safe-top safe-bottom">
        {header('Vorschau', () => setStep('intro'))}
        <main className="flex-1 px-4 py-5 space-y-4 max-w-xl w-full mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-neutral-200" style={{ aspectRatio: String(SPIN_ASPECT) }}>
            <SpinViewer frames={urls} bodyType={vehicle.body_type} frontFrame={front} reverse={reverse} aspect={SPIN_ASPECT}
              showMarkers={markers} autoSpin={false} onFrame={setCurrent} goTo={goTo} />
            <span className="absolute left-2 top-2 qc-badge" style={{ background: 'rgba(255,255,255,0.85)' }}>
              Foto {current + 1}/{urls.length}{current === front ? ' · Front' : ''}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Wische, um das Auto zu drehen. Stelle das Foto ein, das genau die <b>Front</b> zeigt, und tippe auf „Ist die Front“.
            Stehen die Punkte auf der falschen Seite, kehre die Richtung um.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setFront(current)}
              className={'py-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 ' + (current === front ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700')}>
              <Flag size={16} /> Ist die Front
            </button>
            <button type="button" onClick={() => setReverse(r => !r)}
              className={'py-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 ' + (reverse ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700')}>
              <RotateCcw size={16} /> Richtung umkehren
            </button>
            <button type="button" onClick={() => setMarkers(m => !m)}
              className="py-3 rounded-xl border-2 border-gray-200 bg-white text-xs font-bold text-gray-700 flex flex-col items-center gap-1">
              {markers ? <EyeOff size={16} /> : <Eye size={16} />} Punkte {markers ? 'aus' : 'an'}
            </button>
          </div>
          <button type="button" onClick={() => setGoTo(front)} className="text-sm font-semibold text-brand-700">Zur Front springen</button>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
          <div className="flex gap-2">
            <button type="button" disabled={uploading} onClick={() => { setBlobs([]); setStep('intro') }}
              className="flex-1 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-bold disabled:opacity-50">Verwerfen</button>
            <button type="button" disabled={uploading} onClick={save}
              className="flex-[2] py-3 rounded-2xl bg-brand-700 text-white font-bold shadow-md disabled:opacity-70 flex items-center justify-center gap-2">
              {uploading && progress
                ? <>Lade hoch … {progress[0]}/{progress[1]}</>
                : <>Speichern ({urls.length} Fotos)</>}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Intro
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col safe-top safe-bottom">
      {header('360°-Fotos', back)}
      <main className="flex-1 px-4 py-5 space-y-4 max-w-xl w-full mx-auto">
        <div className="qc-card">
          <p className="font-bold text-gray-900 mb-1">{vehicle.model} · <span className="font-mono">{vehicle.license_plate}</span></p>
          <p className="text-sm text-gray-600">Du gehst einmal ums Auto und machst in gleichmäßigen Schritten Fotos. In der Kartei lässt es sich dann per Wischen drehen.</p>
        </div>

        <div className="qc-card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">So klappt’s</p>
          <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
            <li>Freie Fläche rundum, am besten bei bedecktem Himmel (weniger Spiegelungen).</li>
            <li>Starte <b>mittig vor der Front</b>, dann weiter zur <b>rechten Seite</b> (Beifahrerseite).</li>
            <li>Immer gleicher Abstand (ca. 3–4 m) und Handy auf Brusthöhe.</li>
            <li>Auto mittig zwischen die Ecken des Rahmens, das helle Vorbild hilft beim Ausrichten.</li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">Anzahl Fotos</p>
          <div className="flex gap-2">
            {[24, 36].map(n => (
              <button key={n} type="button" onClick={() => setTotal(n)}
                className={'flex-1 py-3 rounded-xl border-2 text-sm font-bold ' + (total === n ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600')}>
                {n} Fotos <span className="block text-[11px] font-semibold opacity-70">{n === 24 ? 'schnell · alle 15°' : 'flüssiger · alle 10°'}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}

        <button type="button" onClick={() => { setBlobs([]); setError(null); setStep('capture') }}
          className="w-full py-4 rounded-2xl bg-brand-700 text-white font-bold text-lg shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <Camera size={20} /> Aufnahme starten
        </button>
        <label className="w-full py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold flex items-center justify-center gap-2 cursor-pointer">
          <Images size={18} /> {progress ? `Verarbeite ${progress[0]}/${progress[1]} …` : 'Fotos aus Galerie wählen'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={importFiles} disabled={!!progress} />
        </label>
        <p className="text-xs text-gray-500 text-center">Galerie: Fotos in Aufnahme-Reihenfolge, beginnend an der Front.</p>

        {spin && (
          <button type="button" onClick={removeExisting}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-600 font-bold flex items-center justify-center gap-2">
            <Trash2 size={16} /> Vorhandene 360°-Fotos löschen ({spin.frame_count})
          </button>
        )}
      </main>
    </div>
  )
}
