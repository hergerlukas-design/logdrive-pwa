import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleDropboxCallback } from '../lib/dropboxClient'

export const DropboxCallback: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    handleDropboxCallback()
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/dashboard'), 1500)
      })
      .catch(err => {
        setStatus('error')
        setError((err as Error).message)
      })
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center gap-6">
      {status === 'loading' && (
        <>
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Dropbox wird verbunden…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">✅</div>
          <div>
            <p className="text-xl font-bold text-gray-900">Dropbox verbunden!</p>
            <p className="text-gray-500 text-sm mt-1">Du wirst weitergeleitet…</p>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl">❌</div>
          <div>
            <p className="text-xl font-bold text-gray-900">Verbindung fehlgeschlagen</p>
            <p className="text-sm text-red-600 mt-2 font-mono">{error}</p>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-brand-700 text-white rounded-2xl font-bold active:scale-95 transition-transform">
            Zurück zum Dashboard
          </button>
        </>
      )}
    </div>
  )
}
