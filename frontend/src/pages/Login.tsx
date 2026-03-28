import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg('Login fehlgeschlagen. Bitte überprüfe deine Daten.')
      setIsLoading(false)
    } else {
      navigate('/dashboard', { replace: true })
    }
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
          <p className="text-gray-400 text-sm mt-1">Digitales Fahrtenbuch</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
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
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center">
            {isLoading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
