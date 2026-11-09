import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { BodyType } from '../lib/database.types'
import { BODY_TYPES, PAINT_COLORS } from '../lib/kartei'
import { CarSilhouette } from '../components/kartei/CarSilhouette'

export const AddVehicle: React.FC = () => {
  const navigate = useNavigate()

  const [model,          setModel]          = useState('')
  const [licensePlate,   setLicensePlate]   = useState('')
  const [currentMileage, setCurrentMileage] = useState<number | ''>('')
  const [bodyType,       setBodyType]       = useState<BodyType>('limousine')
  const [color,          setColor]          = useState(PAINT_COLORS[0])
  const [isSubmitting,   setIsSubmitting]   = useState(false)
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!model.trim() || !licensePlate.trim() || currentMileage === '') {
      setErrorMsg('Bitte fülle alle Felder aus.')
      return
    }
    if (Number(currentMileage) < 0) {
      setErrorMsg('Der Kilometerstand darf nicht negativ sein.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErrorMsg('Nicht eingeloggt.'); setIsSubmitting(false); return }

    const { data, error } = await supabase.from('vehicles').insert({
      user_id: user.id,
      model: model.trim(),
      license_plate: licensePlate.trim(),
      current_mileage: Number(currentMileage),
      body_type: bodyType,
      color,
    }).select('id').single()

    if (error) {
      setErrorMsg(`Fehler beim Speichern: ${error.message}`)
      setIsSubmitting(false)
      return
    }
    // Direkt in die neue Kartei, dort lassen sich Reifen, HU usw. ergänzen
    navigate(data ? `/fahrzeuge/${data.id}` : '/garage')
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50 safe-top safe-bottom">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate('/dashboard')}
          className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="font-bold text-gray-900">Fahrzeug hinzufügen</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">

          {/* Modell */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Fahrzeugmodell</label>
            <input type="text" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
              placeholder="z.B. VW Golf 8"
              value={model}
              onChange={e => setModel(e.target.value)}
            />
          </div>

          {/* Kennzeichen */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kennzeichen</label>
            <input type="text" required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium font-mono tracking-widest uppercase outline-none focus:border-brand-500 transition-colors"
              placeholder="z.B. M-AB 1234"
              value={licensePlate}
              onChange={e => setLicensePlate(e.target.value.toUpperCase())}
            />
          </div>

          {/* Kilometerstand */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Aktueller Kilometerstand</label>
            <input type="number" required min={0}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
              placeholder="z.B. 45000"
              value={currentMileage}
              onChange={e => setCurrentMileage(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <p className="text-xs text-gray-400 mt-1">Bitte den aktuellen Tachostand eintragen.</p>
          </div>

          {/* Bauform & Farbe – bestimmen das Modell in der Fahrzeug-Kartei */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Bauform & Farbe</label>
            <div className="rounded-xl bg-gray-50 border border-gray-200 py-2 mb-3 flex justify-center">
              <CarSilhouette bodyType={bodyType} color={color} className="w-3/4 h-24" />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {BODY_TYPES.map(b => (
                <button key={b.value} type="button" onClick={() => setBodyType(b.value)}
                  className={'px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ' +
                    (bodyType === b.value ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600')}>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PAINT_COLORS.map(c => (
                <button key={c} type="button" aria-label={`Farbe ${c}`} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? '#111' : 'rgba(0,0,0,0.1)' }} />
              ))}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center">
            {isSubmitting
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Fahrzeug speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
