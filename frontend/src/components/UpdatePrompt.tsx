import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

// Wie oft im Hintergrund nach einer neuen Version gesucht wird
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Registriert den Service Worker und zeigt ein Banner, sobald eine neue App-Version bereitsteht. */
export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [updating, setUpdating] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) { setRegistration(reg) },
    onRegisterError(error) { console.error('Service Worker Registrierung fehlgeschlagen', error) },
  })

  // Regelmäßig und beim Zurückkehren in die App nach Updates suchen –
  // installierte PWAs werden auf dem Handy oft tagelang nicht neu geladen.
  useEffect(() => {
    if (!registration) return

    const check = () => {
      if (registration.installing || !navigator.onLine) return
      registration.update().catch(() => { /* offline oder Server nicht erreichbar */ })
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registration])

  if (!needRefresh) return null

  const handleUpdate = async () => {
    setUpdating(true)
    // Aktiviert den wartenden Service Worker und lädt die Seite neu
    await updateServiceWorker(true)
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 safe-bottom pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-md flex items-center gap-3 bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3">
        <RefreshCw size={20} className="text-brand-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Neue Version verfügbar</p>
          <p className="text-xs text-gray-500">Aktualisieren, um die neuesten Funktionen zu laden.</p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={updating}
          className="bg-brand-700 text-white text-sm font-bold rounded-xl px-3 py-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          {updating ? 'Lädt…' : 'Aktualisieren'}
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Später"
          className="text-gray-400 p-1 -mr-1"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
