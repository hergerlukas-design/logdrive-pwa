import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BODY_TYPES, FUEL_LABEL, GROUP_COLOR, cardCode, dateLevel, fmtMonth, fmtNum, type Vehicle, type VehicleSpin } from '../lib/kartei'
import { loadSpinPoster } from '../lib/spin'
import { CarSilhouette } from '../components/kartei/CarSilhouette'
import '../components/kartei/kartei.css'

/** ¾-Foto aus der 360°-Serie, sonst Silhouette */
function MiniVisual({ vehicle, spin }: { vehicle: Vehicle; spin?: VehicleSpin }) {
  const [poster, setPoster] = useState<string | null>(null)
  useEffect(() => {
    if (!spin) return
    let url: string | null = null, cancelled = false
    loadSpinPoster(spin).then(u => { url = u; if (!cancelled) setPoster(u) }).catch(() => undefined)
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [spin])
  if (spin && poster) return <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
  return <CarSilhouette bodyType={vehicle.body_type} color={vehicle.color} />
}

/** Übersicht aller Fahrzeuge als Quartett-Kartenstapel */
export const Garage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [spins, setSpins]       = useState<Record<string, VehicleSpin>>({})

  useEffect(() => {
    supabase.from('vehicles').select('*').order('model').then(({ data, error }) => {
      if (error) setError(error.message)
      setVehicles(data ?? [])
      setLoading(false)
    })
    // Fehlt die Foto-Migration, bleibt es einfach bei den Silhouetten
    supabase.from('vehicle_spins').select('*').then(({ data }) => {
      setSpins(Object.fromEntries((data ?? []).map(s => [s.vehicle_id, s])))
    })
  }, [])

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 safe-top safe-bottom">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={() => navigate('/dashboard')} aria-label="Zurück"
          className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <span className="font-bold text-gray-900">Garage</span>
        <button onClick={() => navigate('/fahrzeug-hinzufuegen')} aria-label="Fahrzeug hinzufügen"
          className="w-9 h-9 rounded-full bg-brand-700 text-white flex items-center justify-center">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <main className="flex-1 px-4 py-5 max-w-xl w-full mx-auto">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}
        {!loading && vehicles.length === 0 && !error && (
          <div className="text-center py-16 text-gray-500">
            <p className="mb-4">Noch keine Fahrzeuge in der Garage.</p>
            <button onClick={() => navigate('/fahrzeug-hinzufuegen')} className="px-5 py-3 rounded-2xl bg-brand-700 text-white font-bold">
              Erstes Fahrzeug anlegen
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {vehicles.map(v => {
            const sameClass = vehicles.filter(x => x.body_type === v.body_type)
            const code = cardCode(v, sameClass.findIndex(x => x.id === v.id))
            const hu = dateLevel(v.hu_due, 60)
            const shared = user && v.user_id !== user.id
            return (
              <button key={v.id} type="button" onClick={() => navigate(`/fahrzeuge/${v.id}`)}
                className="qc qc-mini text-left" style={{ '--qc-group': GROUP_COLOR[v.body_type] } as React.CSSProperties}>
                <div className="qc-inner">
                  <div className="qc-head" style={{ padding: '8px 9px' }}>
                    <div className="qc-code" style={{ width: 32, height: 32, fontSize: 14, borderRadius: 9 }}>{code}</div>
                    <div className="qc-title">
                      <h2 style={{ fontSize: 13 }}>{v.model}</h2>
                      <p className="font-mono text-[10px] text-gray-500 truncate">{v.license_plate}</p>
                    </div>
                  </div>
                  <div className="qc-visual">
                    <MiniVisual vehicle={v} spin={spins[v.id]} />
                    <span className="qc-visual-tag" style={{ fontSize: 8 }}>{BODY_TYPES.find(b => b.value === v.body_type)?.label}</span>
                  </div>
                  <div className="px-2.5 py-2 text-[11px] space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">km</span><b className="tabular-nums">{fmtNum(v.current_mileage)}</b></div>
                    <div className="flex justify-between"><span className="text-gray-500">PS</span><b className="tabular-nums">{fmtNum(v.power_ps)}</b></div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">HU</span>
                      <b className={hu === 'due' ? 'text-red-600' : hu === 'warn' ? 'text-amber-600' : ''}>{fmtMonth(v.hu_due)}</b>
                    </div>
                  </div>
                  <div className="qc-foot" style={{ padding: '6px 10px', fontSize: 8 }}>
                    <span>{v.fuel_type ? FUEL_LABEL[v.fuel_type] : '—'}</span>
                    <span>{shared ? 'geteilt' : ''}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
