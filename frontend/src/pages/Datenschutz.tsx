import React from 'react'
import { useNavigate } from 'react-router-dom'

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-gray-200 p-5">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
    <div className="space-y-2 text-sm text-gray-700 leading-relaxed">{children}</div>
  </section>
)

export const Datenschutz: React.FC = () => {
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
        <h1 className="text-xl font-bold text-gray-900">Datenschutzerklärung</h1>
      </header>

      <main className="flex-1 px-5 pb-8 space-y-4">
        <Section title="1. Verantwortlicher">
          <p>Lukas Herger, Passauerstraße 26, 81369 München</p>
          <p>
            E-Mail:{' '}
            <a href="mailto:herger.lukas@gmail.com" className="text-brand-700">
              herger.lukas@gmail.com
            </a>
          </p>
        </Section>

        <Section title="2. Welche Daten werden verarbeitet">
          <ul className="space-y-1.5">
            <li><span className="font-medium text-gray-900">Account-Daten:</span> E-Mail-Adresse (via Supabase Auth)</li>
            <li><span className="font-medium text-gray-900">Fahrzeugdaten:</span> Modell, Kennzeichen, Kilometerstand</li>
            <li><span className="font-medium text-gray-900">Fahrtenbuch-Einträge:</span> Datum/Uhrzeit, Start- und Zielort, Kilometerstand, Fahrtzweck (dienstlich / privat / Arbeitsweg), Geschäftspartner (optional)</li>
            <li><span className="font-medium text-gray-900">Ausgaben:</span> Betrag, Typ (Tanken / Laden), Datum, ggf. Beleglink</li>
          </ul>
        </Section>

        <Section title="3. Zweck der Verarbeitung">
          <p>
            Digitale Führung eines Fahrtenbuchs zur internen Dokumentation und steuerlichen
            Nachweisführung gemäß § 6 Abs. 1 Nr. 4 EStG.
          </p>
        </Section>

        <Section title="4. Rechtsgrundlage">
          <p>Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflicht zur Fahrtenbuchführung)</p>
          <p>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an interner Dokumentation)</p>
        </Section>

        <Section title="5. Speicherung & Löschung">
          <p>Daten werden auf Servern von Supabase (EU/Irland) gespeichert.</p>
          <p>Fahrtenbuch-Einträge werden nach 10 Jahren gelöscht (steuerliche Aufbewahrungspflicht).</p>
          <p>Supabase DPA ist abgeschlossen.</p>
        </Section>

        <Section title="6. Auftragsverarbeiter">
          <ul className="space-y-1">
            <li><span className="font-medium text-gray-900">Supabase Inc.</span> (Datenbank + Auth) — DPA abgeschlossen</li>
            <li><span className="font-medium text-gray-900">Fly.io Inc.</span> (Hosting) — DPA abgeschlossen</li>
          </ul>
        </Section>

        <Section title="7. Rechte der betroffenen Personen">
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und
            Widerspruch gemäß Art. 15–21 DSGVO.
          </p>
          <p>
            Anfragen an:{' '}
            <a href="mailto:herger.lukas@gmail.com" className="text-brand-700">
              herger.lukas@gmail.com
            </a>
          </p>
        </Section>
      </main>
    </div>
  )
}
