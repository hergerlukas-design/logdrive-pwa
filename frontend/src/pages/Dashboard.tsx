import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database, TripPurpose } from '../lib/database.types'
import { useTrip }  from '../context/TripContext'
import { useAuth }  from '../context/AuthContext'
import { buildFahrtenbuchPdf } from '../lib/pdfBuilder'

type Vehicle = Database['public']['Tables']['vehicles']['Row']
type Trip    = Database['public']['Tables']['trips']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']

type Tab = 'fahrt' | 'ausgabe' | 'historie' | 'einstellungen'

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const Dashboard: React.FC = () => {
  const { activeTrip, isLoadingActiveTrip, checkActiveTrip, clearActiveTrip } = useTrip()
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const { vehicleId: nfcVehicleId } = useParams<{ vehicleId?: string }>()
  const [tab, setTab] = useState<Tab>('fahrt')
  // ── Fahrzeuge ─────────────────────────────────────────────────────────────
  const [vehicles,         setVehicles]         = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)

  // ── Fahrt-Formular ────────────────────────────────────────────────────────
  const [startKm,         setStartKm]         = useState<number | ''>('')
  const [endKm,           setEndKm]           = useState<number | ''>('')
  const [startLocation,   setStartLocation]   = useState('')
  const [endLocation,     setEndLocation]     = useState('')
  const [tripPurpose,     setTripPurpose]     = useState<TripPurpose>('dienstlich')
  const [businessPartner, setBusinessPartner] = useState('')
  const [tripDateTime,    setTripDateTime]    = useState(() => toDateTimeLocal(new Date()))
  const [isFetchingMileage, setIsFetchingMileage] = useState(false)
  const [isSubmitting,      setIsSubmitting]      = useState(false)
  const [errorMsg,          setErrorMsg]          = useState<string | null>(null)

  // ── Historie ──────────────────────────────────────────────────────────────
  const [pastTrips,        setPastTrips]        = useState<Trip[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [deletingTripId,   setDeletingTripId]   = useState<string | null>(null)

  // ── Fahrtenbuch-Historie ──────────────────────────────────────────────────
  const [historyVehicleId,    setHistoryVehicleId]    = useState('')
  const [historyTrips,        setHistoryTrips]        = useState<Trip[]>([])
  const [isLoadingHistoryTrips, setIsLoadingHistoryTrips] = useState(false)
  const HISTORY_PAGE_SIZE = 25
  const [historyLimit,        setHistoryLimit]        = useState(HISTORY_PAGE_SIZE)
  const [historyYear,         setHistoryYear]         = useState(new Date().getFullYear())
  const [isExporting,         setIsExporting]         = useState(false)

  // ── Ausgaben ──────────────────────────────────────────────────────────────
  const [expenses,        setExpenses]        = useState<Expense[]>([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)

  // ── Einstellungen ─────────────────────────────────────────────────────────
  const [nfcStatus, setNfcStatus] = useState<Record<string, 'idle' | 'writing' | 'success' | 'error'>>({})

  const handleWriteNfc = async (vehicleId: string) => {
    setNfcStatus(prev => ({ ...prev, [vehicleId]: 'writing' }))
    const url = `${window.location.origin}/fahrzeug/${vehicleId}`
    try {
      // @ts-ignore – NDEFReader is not in standard TS lib
      const writer = new NDEFReader()
      await Promise.race([
        writer.write({ records: [{ recordType: 'url', data: url }] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
      ])
      setNfcStatus(prev => ({ ...prev, [vehicleId]: 'success' }))
      setTimeout(() => setNfcStatus(prev => ({ ...prev, [vehicleId]: 'idle' })), 3000)
    } catch (err: unknown) {
      console.error('NFC write error:', err)
      setNfcStatus(prev => ({ ...prev, [vehicleId]: 'error' }))
      setTimeout(() => setNfcStatus(prev => ({ ...prev, [vehicleId]: 'idle' })), 4000)
    }
  }

  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

  const currentUserId = user?.id ?? ''

  // Initiales Laden
  useEffect(() => {
    supabase.from('vehicles').select('*').order('model').then(({ data, error }) => {
      if (error) setErrorMsg(`DB-Fehler: ${error.message}`)
      else if (data) {
        setVehicles(data)
        if (data.length > 0) setHistoryVehicleId(data[0].id)
        // NFC deep link: pre-select vehicle from URL param if it belongs to user
        if (nfcVehicleId && data.some(v => v.id === nfcVehicleId)) {
          setSelectedVehicleId(nfcVehicleId)
        }
      }
      setIsLoadingVehicles(false)
    })
    if (currentUserId) checkActiveTrip(currentUserId)
  }, [currentUserId, checkActiveTrip, nfcVehicleId])

  // Kilometer automatisch laden wenn Fahrzeug gewählt
  useEffect(() => {
    if (!selectedVehicleId || activeTrip) return
    setIsFetchingMileage(true)
    supabase.from('vehicles').select('current_mileage').eq('id', selectedVehicleId).single()
      .then(({ data, error }) => {
        if (error) setErrorMsg(`DB-Fehler (KM): ${error.message}`)
        else if (data) setStartKm(data.current_mileage)
        setIsFetchingMileage(false)
      })
  }, [selectedVehicleId, activeTrip])

  // Fahrten-Historie
  useEffect(() => {
    if (!currentUserId) return
    setIsLoadingHistory(true)
    supabase.from('trips').select('*').eq('user_id', currentUserId)
      .not('end_km', 'is', null).order('timestamp', { ascending: false }).limit(10)
      .then(({ data, error }) => {
        if (!error && data) setPastTrips(data)
        setIsLoadingHistory(false)
      })
  }, [currentUserId, activeTrip])

  // Fahrtenbuch-Historie
  useEffect(() => {
    if (tab !== 'historie' || !currentUserId) return
    setIsLoadingHistoryTrips(true)
    const yearStart = new Date(historyYear, 0, 1).toISOString()
    const yearEnd   = new Date(historyYear + 1, 0, 1).toISOString()
    let query = supabase.from('trips').select('*')
      .not('end_km', 'is', null)
      .gte('timestamp', yearStart)
      .lt('timestamp', yearEnd)
      .order('timestamp', { ascending: false })
      .limit(historyLimit)
    if (historyVehicleId) query = query.eq('vehicle_id', historyVehicleId)
    query.then(({ data, error }) => {
      if (!error && data) setHistoryTrips(data)
      setIsLoadingHistoryTrips(false)
    })
  }, [tab, currentUserId, historyVehicleId, historyLimit, historyYear])

  // Ausgaben-Liste
  useEffect(() => {
    if (!currentUserId || tab !== 'ausgabe') return
    setIsLoadingExpenses(true)
    supabase.from('expenses').select('*').eq('driver_id', currentUserId)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (!error && data) setExpenses(data)
        setIsLoadingExpenses(false)
      })
  }, [currentUserId, tab])

  // ── Aktionen ──────────────────────────────────────────────────────────────
  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVehicleId || startKm === '' || !startLocation) {
      setErrorMsg('Bitte fülle alle Pflichtfelder aus.'); return
    }
    setIsSubmitting(true); setErrorMsg(null)
    const { error } = await supabase.from('trips').insert({
      vehicle_id: selectedVehicleId, user_id: currentUserId, driver_id: currentUserId,
      start_km: Number(startKm), start_location: startLocation,
      purpose: tripPurpose,
      business_partner: tripPurpose === 'dienstlich' ? (businessPartner || null) : null,
      timestamp: new Date(tripDateTime).toISOString(),
    })
    if (error) setErrorMsg(`Fehler: ${error.message}`)
    else {
      await checkActiveTrip(currentUserId)
      setStartLocation(''); setTripDateTime(toDateTimeLocal(new Date()))
      setTripPurpose('dienstlich'); setBusinessPartner('')
    }
    setIsSubmitting(false)
  }

  const handleEndTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTrip || endKm === '' || !endLocation) {
      setErrorMsg('Bitte fülle alle Pflichtfelder aus.'); return
    }
    if (Number(endKm) < activeTrip.start_km) {
      setErrorMsg(`End-KM darf nicht kleiner sein als Start-KM (${activeTrip.start_km}).`); return
    }
    setIsSubmitting(true); setErrorMsg(null)
    const { error } = await supabase.from('trips').update({ end_km: Number(endKm), end_location: endLocation }).eq('id', activeTrip.id)
    if (error) setErrorMsg(`Fehler: ${error.message}`)
    else { clearActiveTrip(); setEndKm(''); setEndLocation(''); setSelectedVehicleId('') }
    setIsSubmitting(false)
  }

  const handleDeleteTrip = async (tripId: string) => {
    setDeletingTripId(tripId)
    const { error } = await supabase.from('trips').delete().eq('id', tripId)
    if (error) { setErrorMsg(`Fehler: ${error.message}`); setDeletingTripId(null); return }
    setPastTrips(prev => prev.filter(t => t.id !== tripId))
    setDeletingTripId(null)
  }

  const handleExportPdf = async () => {
    if (!historyVehicleId) return
    const vehicle = vehicles.find(v => v.id === historyVehicleId)
    if (!vehicle) return
    setIsExporting(true)
    // Load ALL trips for this vehicle+year (no limit) for the export
    const yearStart = new Date(historyYear, 0, 1).toISOString()
    const yearEnd   = new Date(historyYear + 1, 0, 1).toISOString()
    const { data, error } = await supabase.from('trips').select('*')
      .eq('vehicle_id', historyVehicleId)
      .not('end_km', 'is', null)
      .gte('timestamp', yearStart)
      .lt('timestamp', yearEnd)
      .order('timestamp', { ascending: true })
    if (error || !data) { setErrorMsg(`Fehler beim Export: ${error?.message}`); setIsExporting(false); return }
    const blob = buildFahrtenbuchPdf({
      trips: data,
      vehicle,
      driverName: user?.email ?? 'Unbekannt',
      year: historyYear,
    })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `Fahrtenbuch_${vehicle.license_plate.replace(/\s/g, '-')}_${historyYear}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setIsExporting(false)
  }

  const formatDate = (d: string) => new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(d))

  const formatDateShort = (d: string) => new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(d))

  const isNachtrag = (timestamp: string, createdAt: string) => {
    return new Date(timestamp).toDateString() !== new Date(createdAt).toDateString()
  }

  const isTripDateToday = new Date(tripDateTime).toDateString() === new Date().toDateString()

  if (isLoadingVehicles || isLoadingActiveTrip) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50 safe-top">

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">

        {/* Tab: Fahrt */}
        {tab === 'fahrt' && (
          <div className="px-5 pt-5 pb-4 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">Fahrtenbuch</h1>
              {activeTrip && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  Aktive Fahrt
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}

            {!activeTrip ? (
              /* Fahrt starten */
              <form onSubmit={handleStartTrip} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-700">Neue Fahrt starten</p>
                  {!isTripDateToday && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Nachtrag</span>
                  )}
                </div>

                {/* Fahrzeug */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fahrzeug</label>
                  <select required
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                    value={selectedVehicleId}
                    onChange={e => setSelectedVehicleId(e.target.value)}>
                    <option value="">— Fahrzeug wählen —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>🚗 {v.model} · {v.license_plate}</option>
                    ))}
                  </select>
                </div>

                {/* Start-KM */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Start-Kilometerstand
                    {isFetchingMileage && <span className="ml-2 w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin inline-block" />}
                  </label>
                  <input type="number"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                    value={startKm} placeholder="z.B. 150000" required disabled={isFetchingMileage}
                    onChange={e => setStartKm(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>

                {/* Reisezweck */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Reisezweck</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'dienstlich', label: 'Dienstlich' },
                      { value: 'privat',     label: 'Privat' },
                      { value: 'arbeitsweg', label: 'Arbeitsweg' },
                    ] as { value: TripPurpose; label: string }[]).map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setTripPurpose(opt.value)}
                        className={['flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors',
                          tripPurpose === opt.value
                            ? 'bg-brand-700 border-brand-700 text-white'
                            : 'bg-white border-gray-200 text-gray-600'].join(' ')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geschäftspartner (nur bei dienstlich) */}
                {tripPurpose === 'dienstlich' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Geschäftspartner / Kunde</label>
                    <input type="text"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                      value={businessPartner} placeholder="z.B. Audi AG München"
                      onChange={e => setBusinessPartner(e.target.value)} />
                  </div>
                )}

                {/* Startort */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Startort</label>
                  <input type="text"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                    value={startLocation} placeholder="z.B. München Büro" required
                    onChange={e => setStartLocation(e.target.value)} />
                </div>

                {/* Datum & Uhrzeit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Datum &amp; Uhrzeit
                    {!isTripDateToday && <span className="ml-2 text-xs font-semibold text-amber-600">· Nachtrag</span>}
                  </label>
                  <input type="datetime-local"
                    className={['w-full px-4 py-3 rounded-xl border-2 bg-white text-gray-900 font-medium outline-none transition-colors',
                      !isTripDateToday ? 'border-amber-300 focus:border-amber-500' : 'border-gray-200 focus:border-brand-500'].join(' ')}
                    value={tripDateTime}
                    max={toDateTimeLocal(new Date())}
                    onChange={e => setTripDateTime(e.target.value)} />
                </div>

                <button type="submit" disabled={isSubmitting || isFetchingMileage}
                  className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting
                    ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><span>▶</span> Fahrt starten</>}
                </button>
              </form>
            ) : (
              /* Fahrt beenden */
              <form onSubmit={handleEndTrip} className="bg-white rounded-2xl border-2 border-green-400 p-5 space-y-4 shadow-sm">
                <div>
                  <p className="font-semibold text-gray-900">Aktive Fahrt beenden</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Gestartet bei {activeTrip.start_km.toLocaleString('de-DE')} km · {activeTrip.start_location}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End-Kilometerstand</label>
                  <input type="number"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                    value={endKm} placeholder={`Min. ${activeTrip.start_km}`} required
                    onChange={e => setEndKm(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Zielort</label>
                  <input type="text"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-medium outline-none focus:border-brand-500 transition-colors"
                    value={endLocation} placeholder="z.B. Kundentermin Berlin" required
                    onChange={e => setEndLocation(e.target.value)} />
                </div>

                <div className="flex gap-3">
                  {/* Schnell-Button: Ausgabe erfassen für dieses Fahrzeug */}
                  <button type="button"
                    onClick={() => navigate(`/ausgabe-erfassen?vehicle=${activeTrip.vehicle_id}`)}
                    className="flex-1 py-3 border-2 border-gray-200 bg-white text-gray-600 rounded-2xl font-semibold text-sm active:scale-95 transition-transform">
                    ⛽ Ausgabe
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting
                      ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><span>■</span> Fahrt beenden</>}
                  </button>
                </div>
              </form>
            )}

            {/* Fahrten-Historie */}
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Letzte Fahrten</p>
              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pastTrips.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-sm">
                  Noch keine beendeten Fahrten.
                </div>
              ) : (
                <div className="space-y-2">
                  {pastTrips.map(trip => (
                    <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-400 shrink-0">{formatDate(trip.timestamp)}</span>
                          {isNachtrag(trip.timestamp, trip.created_at) && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Nachtrag</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                            {trip.end_km && (trip.end_km - trip.start_km).toLocaleString('de-DE')} km
                          </span>
                          <button type="button"
                            onClick={() => handleDeleteTrip(trip.id)}
                            disabled={deletingTripId === trip.id}
                            className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center active:scale-95 transition-transform text-xs disabled:opacity-50">
                            {deletingTripId === trip.id
                              ? <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : '🗑️'}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {trip.start_location} <span className="text-gray-400">→</span> {trip.end_location}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={['text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                          trip.purpose === 'dienstlich' ? 'bg-blue-100 text-blue-700' :
                          trip.purpose === 'arbeitsweg' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-500'].join(' ')}>
                          {trip.purpose === 'dienstlich' ? 'Dienstlich' : trip.purpose === 'arbeitsweg' ? 'Arbeitsweg' : 'Privat'}
                        </span>
                        {trip.business_partner && (
                          <span className="text-xs text-gray-400 truncate">{trip.business_partner}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Ausgabe */}
        {tab === 'ausgabe' && (
          <div className="px-5 pt-5 pb-4 space-y-5">
            <h1 className="text-xl font-bold text-gray-900">Ausgaben</h1>

            <button onClick={() => navigate('/ausgabe-erfassen')}
              className="w-full flex items-center gap-5 px-6 py-5 bg-brand-700 text-white rounded-3xl shadow-lg active:scale-95 transition-transform">
              <span className="text-4xl">📷</span>
              <div className="text-left">
                <p className="font-bold text-lg">Ausgabe erfassen</p>
                <p className="text-brand-200 text-sm">Beleg scannen &amp; in Dropbox hochladen</p>
              </div>
              <span className="ml-auto text-2xl opacity-60">›</span>
            </button>

            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Letzte Ausgaben</p>
              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-sm">
                  Noch keine Ausgaben erfasst.
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map(exp => {
                    const CardEl = exp.dropbox_link ? 'a' : 'div'
                    const cardProps = exp.dropbox_link
                      ? { href: exp.dropbox_link, target: '_blank' as const, rel: 'noopener noreferrer' }
                      : {}
                    return (
                      <CardEl key={exp.id} {...cardProps}
                        className={['bg-white border rounded-2xl px-4 py-4 shadow-sm block',
                          exp.dropbox_link
                            ? 'border-brand-200 active:scale-[0.98] transition-transform cursor-pointer'
                            : 'border-gray-200'].join(' ')}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>{exp.type === 'fuel' ? '⛽' : '⚡'}</span>
                            <span className="text-sm font-semibold text-gray-700">{exp.type === 'fuel' ? 'Tanken' : 'Laden'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{exp.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                            {exp.dropbox_link && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatDateShort(exp.date)}</p>
                      </CardEl>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Historie */}
        {tab === 'historie' && (
          <div className="px-5 pt-5 pb-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">Fahrtenbuch</h1>
              {/* Jahres-Auswahl */}
              <select
                value={historyYear}
                onChange={e => { setHistoryYear(Number(e.target.value)); setHistoryLimit(HISTORY_PAGE_SIZE) }}
                className="px-3 py-1.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-semibold text-sm outline-none focus:border-brand-500">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Fahrzeug-Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {vehicles.map(v => (
                <button key={v.id}
                  onClick={() => { setHistoryVehicleId(v.id); setHistoryLimit(HISTORY_PAGE_SIZE) }}
                  className={['shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                    historyVehicleId === v.id
                      ? 'bg-brand-700 text-white'
                      : 'bg-white border border-gray-200 text-gray-600'].join(' ')}>
                  {v.license_plate}
                </button>
              ))}
            </div>

            {/* Fahrzeuganzeige wenn gefiltert */}
            {historyVehicleId && (() => {
              const v = vehicles.find(x => x.id === historyVehicleId)
              return v ? (
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="font-semibold text-gray-900">{v.model}</p>
                    <p className="text-xs text-gray-400 font-mono">{v.license_plate} · {v.current_mileage.toLocaleString('de-DE')} km</p>
                  </div>
                </div>
              ) : null
            })()}

            {/* PDF-Export */}
            {historyVehicleId && (
              <button
                onClick={handleExportPdf}
                disabled={isExporting || historyTrips.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-700 text-white rounded-2xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
                {isExporting
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '📄'}
                {isExporting ? 'Erstelle PDF…' : `Fahrtenbuch ${historyYear} exportieren`}
              </button>
            )}

            {/* Fahrten-Liste */}
            {isLoadingHistoryTrips ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyTrips.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
                {historyVehicleId ? 'Keine Fahrten für dieses Fahrzeug.' : 'Noch keine abgeschlossenen Fahrten.'}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {historyTrips.map(trip => {
                    const km = trip.end_km ? trip.end_km - trip.start_km : 0
                    return (
                      <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-400 shrink-0">{formatDate(trip.timestamp)}</span>
                            {isNachtrag(trip.timestamp, trip.created_at) && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Nachtrag</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full shrink-0">
                            {km.toLocaleString('de-DE')} km
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 truncate">
                          {trip.start_location} <span className="text-gray-400">→</span> {trip.end_location}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={['text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            trip.purpose === 'dienstlich' ? 'bg-blue-100 text-blue-700' :
                            trip.purpose === 'arbeitsweg' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-500'].join(' ')}>
                            {trip.purpose === 'dienstlich' ? 'Dienstlich' : trip.purpose === 'arbeitsweg' ? 'Arbeitsweg' : 'Privat'}
                          </span>
                          {trip.business_partner && (
                            <span className="text-xs text-gray-400 truncate">{trip.business_partner}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {trip.start_km.toLocaleString('de-DE')} → {trip.end_km?.toLocaleString('de-DE')} km
                        </p>
                      </div>
                    )
                  })}
                </div>
                {historyTrips.length >= historyLimit && (
                  <button
                    onClick={() => setHistoryLimit(l => l + HISTORY_PAGE_SIZE)}
                    className="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm active:scale-95 transition-transform">
                    Mehr laden
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Einstellungen */}
        {tab === 'einstellungen' && (
          <div className="px-5 pt-5 pb-4 space-y-5">
            <h1 className="text-xl font-bold text-gray-900">Einstellungen</h1>

            {/* Fahrzeug */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fahrzeuge</p>
              </div>
              {vehicles.map(v => {
                const status = nfcStatus[v.id] ?? 'idle'
                return (
                  <div key={v.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <span>🚗</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{v.model}</p>
                      <p className="font-mono text-xs text-gray-500">{v.license_plate}</p>
                    </div>
                    {nfcSupported && (
                      <button
                        onClick={() => handleWriteNfc(v.id)}
                        disabled={status === 'writing'}
                        className={[
                          'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                          status === 'writing' ? 'border-brand-300 text-brand-500 opacity-60' :
                          status === 'success' ? 'border-green-300 text-green-700 bg-green-50' :
                          status === 'error'   ? 'border-red-300 text-red-600 bg-red-50' :
                          'border-gray-200 text-gray-600 active:bg-gray-50',
                        ].join(' ')}
                      >
                        {status === 'writing' ? 'Warte…' :
                         status === 'success' ? 'Beschrieben ✓' :
                         status === 'error'   ? 'Fehler – nochmal' :
                         'NFC beschreiben'}
                      </button>
                    )}
                  </div>
                )
              })}
              <button onClick={() => navigate('/fahrzeug-hinzufuegen')}
                className="w-full px-4 py-3 flex items-center gap-3 text-brand-700 font-semibold text-sm active:bg-gray-50 transition-colors">
                <span>+</span> Fahrzeug hinzufügen
              </button>
            </section>

            {/* App-Info */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">App</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[['Version', '1.0.0'], ['Modus', 'Progressive Web App'], ['Backend', 'Supabase']].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-500">{k}</span>
                    <span className="text-sm font-medium text-gray-900">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Rechtliches */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rechtliches</p>
              </div>
              <div className="divide-y divide-gray-100">
                <Link to="/impressum" className="flex justify-between items-center px-4 py-3 active:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-700">Impressum</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
                <Link to="/datenschutz" className="flex justify-between items-center px-4 py-3 active:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-700">Datenschutzerklärung</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </div>
            </section>

            {/* Abmelden */}
            <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              className="w-full py-3 border-2 border-red-200 text-red-600 rounded-2xl font-semibold active:scale-95 transition-transform">
              Abmelden
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="flex bg-white border-t border-gray-200 safe-bottom shrink-0">
        {([
          {
            id: 'fahrt' as Tab, label: 'Fahrt', badge: 0,
            icon: <><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
          },
          {
            id: 'ausgabe' as Tab, label: 'Ausgabe', badge: 0,
            icon: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
          },
          {
            id: 'historie' as Tab, label: 'Historie', badge: 0,
            icon: <><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></>,
          },
          {
            id: 'einstellungen' as Tab, label: 'Einstellungen', badge: 0,
            icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
          },
        ]).map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 relative">
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-700 rounded-full" />}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={active ? 'text-brand-700' : 'text-gray-400'}>
                {t.icon}
              </svg>
              <span className={'text-[10px] font-semibold ' + (active ? 'text-brand-700' : 'text-gray-400')}>{t.label}</span>
              {t.badge > 0 && (
                <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
