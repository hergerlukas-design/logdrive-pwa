import { useEffect, useState, useCallback } from 'react'
import { useCamera } from '../../hooks/useCamera'

interface Props {
  onCapture: (dataUrl: string) => void
  onBack:    () => void
}

export default function CameraView({ onCapture, onBack }: Props) {
  const [wrongOrientation, setWrongOrientation] = useState(false)
  const [cropReady,        setCropReady]        = useState(false)
  const [flash,            setFlash]            = useState(false)

  const { videoRef, isReady, error, startCamera, takePhoto, flipCamera } = useCamera()

  useEffect(() => { startCamera() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const styleEl = document.createElement('style')
    styleEl.textContent = '@keyframes scanLine{0%{top:10%;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:90%;opacity:0}}'
    document.head.appendChild(styleEl)
    return () => { document.head.removeChild(styleEl) }
  }, [])

  useEffect(() => {
    function check() { setWrongOrientation(window.innerWidth > window.innerHeight) }
    check()
    window.addEventListener('orientationchange', check)
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('orientationchange', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  useEffect(() => {
    if (!isReady) return
    const t = setTimeout(() => setCropReady(true), 1200)
    return () => clearTimeout(t)
  }, [isReady])

  const capturePhoto = useCallback(() => {
    const dataUrl = takePhoto()
    if (!dataUrl) return
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    onCapture(dataUrl)
  }, [takePhoto, onCapture])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onCapture(ev.target!.result as string)
    reader.readAsDataURL(file)
  }, [onCapture])

  const loading = !isReady && !error

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center justify-between px-5 py-3 safe-top">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">Beleg scannen</span>
        <div className="w-9" />
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black" />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/60">Kamera wird gestartet…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 px-5">
            <p className="font-bold text-white text-center">Kein Kamerazugriff</p>
            <p className="text-sm text-white/60 text-center">{error}</p>
            <label className="px-6 py-3 bg-white text-gray-900 rounded-2xl font-bold cursor-pointer">
              Aus Galerie wählen
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
            </label>
          </div>
        )}

        {!error && (
          <>
            <video ref={videoRef} playsInline muted autoPlay
              className="absolute inset-0 w-full h-full object-cover" />

            <div className="absolute z-10 transition-all duration-500"
              style={{
                width: '78%', aspectRatio: '1 / 1.41', maxHeight: '88%',
                boxShadow: `0 0 0 9999px rgba(0,0,0,${cropReady ? '0.55' : '0.4'})`,
                borderRadius: 4,
              }}>
              {(['top-0 left-0 border-t-2 border-l-2',
                 'top-0 right-0 border-t-2 border-r-2',
                 'bottom-0 left-0 border-b-2 border-l-2',
                 'bottom-0 right-0 border-b-2 border-r-2',
              ] as const).map((cls, i) => (
                <div key={i} className={'absolute w-7 h-7 transition-colors duration-500 ' + cls}
                  style={{ borderColor: cropReady ? '#bc0120' : 'rgba(255,255,255,0.8)' }} />
              ))}
              {cropReady && (
                <div className="absolute left-0 right-0 h-px" style={{
                  background: 'linear-gradient(90deg,transparent,#bc0120,transparent)',
                  animation:  'scanLine 2s ease-in-out infinite',
                  top: '40%',
                }} />
              )}
            </div>

            {flash && <div className="absolute inset-0 bg-white z-30 pointer-events-none" />}

            {wrongOrientation && (
              <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center gap-4 px-5 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                <p className="font-bold text-white">Bitte Gerät drehen</p>
                <p className="text-sm text-white/60">Halte dein Gerät hochkant für Belege.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-center py-2">
        {cropReady && !error
          ? <span className="text-xs text-brand-300">Kante erkannt — halte ruhig</span>
          : <span className="text-xs text-white/40">Beleg im Rahmen positionieren</span>}
      </div>

      <div className="px-5 pb-8 pt-2">
        <div className="flex items-center justify-between">
          <label className="flex flex-col items-center gap-1 cursor-pointer">
            <div className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <span className="text-xs text-white/50">Galerie</span>
            <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
          </label>

          <button onClick={capturePhoto} disabled={loading || !!error || wrongOrientation}
            className="w-20 h-20 rounded-full bg-white border-4 border-brand-600 shadow-xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40">
            <div className={'w-14 h-14 rounded-full transition-colors duration-200 ' + (cropReady ? 'bg-brand-600' : 'bg-brand-600/80')} />
          </button>

          <button onClick={flipCamera} className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </div>
            <span className="text-xs text-white/50">Flip</span>
          </button>
        </div>
      </div>
    </div>
  )
}
