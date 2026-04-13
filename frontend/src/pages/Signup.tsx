import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export const Signup: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirm) {
      setErrorMsg('Die Passwörter stimmen nicht überein.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setIsLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setErrorMsg('Registrierung fehlgeschlagen. Möglicherweise existiert diese E-Mail bereits.')
      setIsLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 p-5 safe-top safe-bottom">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-md">
            ✉️
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fast geschafft!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Wir haben dir eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
            Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.
          </p>
          <button
            onClick={() => navigate(`/login${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`)}
            className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform"
          >
            Zum Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 p-5 safe-top safe-bottom">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-700 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-md">
            🚗
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LogDrive</h1>
          <p className="text-gray-400 text-sm mt-1">Konto erstellen</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
          {/* E-Mail */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">E-Mail</label>
            <input
              type="email" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
              placeholder="fahrer@logdrive.app"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Passwort */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Passwort</label>
            <input
              type="password" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
              placeholder="Mindestens 6 Zeichen"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {/* Passwort bestätigen */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Passwort bestätigen</label>
            <input
              type="password" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center">
            {isLoading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Bereits ein Konto?{' '}
          <Link to={`/login${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brand-700 font-semibold">Anmelden</Link>
        </p>
      </div>
    </div>
  )
}
