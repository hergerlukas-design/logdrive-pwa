import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  fileName:  string
  queued:    boolean
  onScanNew: () => void
}

export default function SuccessScreen({ fileName, queued, onScanNew }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100])
  }, [])

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 bg-gray-50 p-8 text-center gap-6">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl
        ${queued ? 'bg-amber-100' : 'bg-green-100'}`}>
        {queued ? '📥' : '✅'}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {queued ? 'In Queue gespeichert' : 'Ausgabe gespeichert!'}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {queued
            ? 'Du bist offline. Der Dropbox-Upload wird nachgeholt, sobald du wieder Netzempfang hast. In Supabase wurde die Ausgabe bereits gespeichert.'
            : 'Beleg wurde in Dropbox hochgeladen und in der Datenbank gespeichert.'}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 w-full">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Datei</p>
        <p className="text-sm font-mono text-gray-800 break-all">{fileName}</p>
      </div>

      <div className="w-full space-y-3">
        <button onClick={onScanNew}
          className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform">
          Neue Ausgabe erfassen
        </button>
        <button onClick={() => navigate('/dashboard')}
          className="w-full py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform">
          Zum Dashboard
        </button>
      </div>
    </div>
  )
}
