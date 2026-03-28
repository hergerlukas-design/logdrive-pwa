import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { useTrip }  from '../context/TripContext'
import { useAuth }  from '../context/AuthContext'
import { isDropboxConnected, startDropboxLogin, logoutDropbox, switchDropboxAccount, getDropboxFolder, setDropboxFolder } from '../lib/dropboxClient'
import { useUploadQueue } from '../hooks/useUploadQueue'

type Vehicle = Database['public']['Tables']['vehicles']['Row']
type Trip    = Database['public']['Tables']['trips']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']

type Tab = 'fahrt' | 'ausgabe' | 'einstellungen'

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const Dashboard: React.FC = () => {
  const { activeTrip, isLoadingActiveTrip, checkActiveTrip, clearActiveTrip } = useTrip()
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [tab, setTab] = useState<Tab>('fahrt')
  const { pendingCount } = useUploadQueue()

  // ── Fahrzeuge ─────────────────────────────────────────────────────────────
  const [vehicles,         setVehicles]         = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)

  // ── Fahrt-Formular ────────────────────────────────────────────────────────
  const [startKm,       setStartKm]       = useState<number | ''>('')
  const [endKm,         setEndKm]         = useState<number | ''>('')
  const [startLocation, setStartLocation] = useState('')
  const [endLocation,   setEndLocation]   = useState('')
  const [tripDateTime,  setTripDateTime]  = useState(() => toDateTimeLocal(new Date()))
  const [isFetchingMileage, setIsFetchingMileage] = useState(false)
  const [isSubmitting,      setIsSubmitting]      = useState(false)
  const [errorMsg,          setErrorMsg]          = useState<string | null>(null)

  // ── Historie ──────────────────────────────────────────────────────────────
  const [pastTrips,        setPastTrips]        = useState<Trip[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [editingTripId,    setEditingTripId]    = useState<string | null>(null)
  const [editDateTime,     setEditDateTime]     = useState('')
  const [isSavingEdit,     setIsSavingEdit]     = useState(false)

  // ── Ausgaben ──────────────────────────────────────────────────────────────
  const [expenses,        setExpenses]        = useState<Expense[]>([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)

  // ── Einstellungen ─────────────────────────────────────────────────────────
  const [dropboxConnected, setDropboxConnected] = useState(false)
  const [isLoggingIn,      setIsLoggingIn]      = useState(false)
  const [dropboxFolder,    setDropboxFolderState] = useState(() => getDropboxFolder())
  const [folderSaved,      setFolderSaved]      = useState(false)

  const currentUserId = user?.id ?? ''

  // Initiales Laden
  useEffect(() => {
    supabase.from('vehicles').select('*').order('model').then(({ data, error }) => {
      if (error) setErrorMsg(`DB-Fehler: ${error.message}`)
      else if (data) setVehicles(data)
      setIsLoadingVehicles(false)
    })
    if (currentUserId) checkActiveTrip(currentUserId)
    setDropboxConnected(isDropboxConnected())
  }, [currentUserId, checkActiveTrip])

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

  // Ausgaben-Liste
  useEffect(() => {
    if (!currentUserId || tab !== 'ausgabe') return
    setIsLoadingExpenses(true)
    supabase.from('expenses').select('*').eq('user_id', currentUserId)
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
      timestamp: new Date(tripDateTime).toISOString(),
    })
    if (error) setErrorMsg(`Fehler: ${error.message}`)
    else { await checkActiveTrip(currentUserId); setStartLocation(''); setTripDateTime(toDateTimeLocal(new Date())) }
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

  const handleUpdateTrip = async (tripId: string) => {
    if (!editDateTime) return
    setIsSavingEdit(true)
    const { error } = await supabase.from('trips').update({ timestamp: new Date(editDateTime).toISOString() }).eq('id', tripId)
    if (error) { setErrorMsg(`Fehler: ${error.message}`); setIsSavingEdit(false); return }
    setPastTrips(prev => prev.map(t => t.id === tripId ? { ...t, timestamp: new Date(editDateTime).toISOString() } : t))
    setEditingTripId(null)
    setIsSavingEdit(false)
  }

  const handleDropboxConnect = async () => {
    setIsLoggingIn(true)
    try { await startDropboxLogin() } catch { setIsLoggingIn(false) }
  }

  const handleDropboxDisconnect = () => {
    logoutDropbox()
    setDropboxConnected(false)
  }

  const handleDropboxSwitch = async () => {
    setIsLoggingIn(true)
    try { await switchDropboxAccount() } catch { setIsLoggingIn(false) }
  }

  const handleSaveFolder = () => {
    setDropboxFolder(dropboxFolder)
    setDropboxFolderState(getDropboxFolder())
    setFolderSaved(true)
    setTimeout(() => setFolderSaved(false), 2000)
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
                            onClick={() => { setEditingTripId(trip.id); setEditDateTime(toDateTimeLocal(new Date(trip.timestamp))) }}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95 transition-transform text-xs">
                            ✏️
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {trip.start_location} <span className="text-gray-400">→</span> {trip.end_location}
                      </p>

                      {/* Inline-Editor */}
                      {editingTripId === trip.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <label className="block text-xs font-semibold text-gray-500">Datum &amp; Uhrzeit anpassen</label>
                          <input type="datetime-local"
                            className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 bg-white text-gray-900 text-sm font-medium outline-none focus:border-amber-500 transition-colors"
                            value={editDateTime}
                            max={toDateTimeLocal(new Date())}
                            onChange={e => setEditDateTime(e.target.value)} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setEditingTripId(null)}
                              className="flex-1 py-2 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold active:scale-95 transition-transform">
                              Abbrechen
                            </button>
                            <button type="button" onClick={() => handleUpdateTrip(trip.id)} disabled={isSavingEdit}
                              className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-60 active:scale-95 transition-transform flex items-center justify-center">
                              {isSavingEdit
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : 'Speichern'}
                            </button>
                          </div>
                        </div>
                      )}
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

            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">📥</span>
                <p className="text-sm text-amber-800 font-semibold">
                  {pendingCount} Upload{pendingCount > 1 ? 's' : ''} in der Queue
                </p>
              </div>
            )}

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
                  {expenses.map(exp => (
                    <div key={exp.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>{exp.expense_type === 'tanken' ? '⛽' : '⚡'}</span>
                          <span className="text-sm font-semibold text-gray-700">{exp.project ?? '—'}</span>
                        </div>
                        <span className="font-bold text-gray-900">{exp.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatDateShort(exp.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Einstellungen */}
        {tab === 'einstellungen' && (
          <div className="px-5 pt-5 pb-4 space-y-5">
            <h1 className="text-xl font-bold text-gray-900">Einstellungen</h1>

            {/* Dropbox */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dropbox</p>
              </div>

              {/* Verbindungsstatus */}
              <div className="px-4 py-4 flex items-center gap-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{dropboxConnected ? 'Verbunden' : 'Nicht verbunden'}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {dropboxConnected ? 'Belege werden in Dropbox gespeichert.' : 'Verbinde Dropbox für automatische Uploads.'}
                  </p>
                </div>
                {dropboxConnected ? (
                  <button onClick={handleDropboxDisconnect}
                    className="px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold active:scale-95 transition-transform shrink-0">
                    Trennen
                  </button>
                ) : (
                  <button onClick={handleDropboxConnect} disabled={isLoggingIn}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 active:scale-95 transition-transform shrink-0">
                    {isLoggingIn ? '…' : 'Verbinden'}
                  </button>
                )}
              </div>

              {/* Konto wechseln */}
              {dropboxConnected && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Konto wechseln</p>
                    <p className="text-xs text-gray-400">Mit einem anderen Dropbox-Konto verbinden</p>
                  </div>
                  <button onClick={handleDropboxSwitch} disabled={isLoggingIn}
                    className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60 shrink-0">
                    {isLoggingIn ? '…' : 'Wechseln'}
                  </button>
                </div>
              )}

              {/* Ordner-Einstellung */}
              <div className="px-4 py-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Basis-Ordner</label>
                <p className="text-xs text-gray-400 mb-2">Belege werden unter <span className="font-mono">{dropboxFolder}/[Kennzeichen]/</span> gespeichert</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dropboxFolder}
                    onChange={e => setDropboxFolderState(e.target.value)}
                    placeholder="/LogDrive"
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-900 font-mono text-sm outline-none focus:border-brand-500 transition-colors"
                  />
                  <button onClick={handleSaveFolder}
                    className={['px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-all shrink-0',
                      folderSaved ? 'bg-green-500 text-white' : 'bg-brand-700 text-white'].join(' ')}>
                    {folderSaved ? '✓' : 'Speichern'}
                  </button>
                </div>
              </div>
            </section>

            {/* Fahrzeug */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fahrzeuge</p>
              </div>
              {vehicles.map(v => (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                  <span>🚗</span>
                  <span className="flex-1 font-medium text-gray-900">{v.model}</span>
                  <span className="font-mono text-sm text-gray-500">{v.license_plate}</span>
                </div>
              ))}
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
            id: 'ausgabe' as Tab, label: 'Ausgabe', badge: pendingCount,
            icon: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
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
