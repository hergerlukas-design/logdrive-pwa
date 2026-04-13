import React from 'react'
import { useNavigate } from 'react-router-dom'

export const Impressum: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 safe-top safe-bottom">
      <header className="flex items-center gap-3 px-5 pt-5 pb-4 bg-gray-50">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 active:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Impressum</h1>
      </header>

      <main className="flex-1 px-5 pb-8 space-y-5">
        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Angaben gemäß § 5 TMG</p>
            <p className="text-gray-900 font-medium">Lukas Herger</p>
            <p className="text-gray-700">Passauerstraße 26</p>
            <p className="text-gray-700">81369 München</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kontakt</p>
            <div className="space-y-1">
              <p className="text-gray-700">
                <span className="font-medium text-gray-900">Telefon:</span>{' '}
                <a href="tel:+491603504039" className="text-brand-700">+49 160 3504039</a>
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-gray-900">E-Mail:</span>{' '}
                <a href="mailto:herger.lukas@gmail.com" className="text-brand-700">herger.lukas@gmail.com</a>
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
            </p>
            <p className="text-gray-700">Lukas Herger, Passauerstraße 26, 81369 München</p>
          </div>
        </section>
      </main>
    </div>
  )
}
