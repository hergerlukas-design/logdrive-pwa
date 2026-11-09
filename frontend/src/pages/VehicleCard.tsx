import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Wrench, NotebookPen, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VehicleSection } from '../lib/database.types'
import {
  HOTSPOT_SHEET, SHEET_TITLE, SHEET_SECTION, SECTION_LABEL, cardCode, dateLevel, kmLevel, treadLevel, fmtDate, worst,
  type Vehicle, type TireSet, type ServiceEntry, type VehicleNote, type VehicleMember, type SheetId, type HotspotId, type Level,
} from '../lib/kartei'
import { QuartettCard } from '../components/kartei/QuartettCard'
import { CarSilhouette } from '../components/kartei/CarSilhouette'
import { Sheet } from '../components/kartei/Sheet'
import { DatenSheet, TermineSheet, ReifenSheet, WartungSheet, NotizenSheet, FahrerSheet } from '../components/kartei/sheets'
import '../components/kartei/kartei.css'

// three.js nur laden, wenn die Kartei geöffnet wird
const Car3D = lazy(() => import('../components/kartei/Car3D'))

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

class VisualBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ═════════════════════════════════════════════════════════════════════════
// Darstellung (ohne Datenzugriff – auch für Vorschau/Tests nutzbar)
// ═════════════════════════════════════════════════════════════════════════

export interface KarteiData {
  vehicle:    Vehicle
  code:       string
  tires:      TireSet[]
  service:    ServiceEntry[]
  notes:      VehicleNote[]
  members:    VehicleMember[]
  isOwner:    boolean
  /** Abschnitte, die der aktuelle Nutzer als Fahrer bearbeiten darf */
  mySections: VehicleSection[]
  userEmail:  string | null
}

export function KarteiView({ data, onBack, onChanged }: { data: KarteiData; onBack: () => void; onChanged: () => void }) {
  const { vehicle, tires, service, notes, members, isOwner, mySections } = data
  const [sheet, setSheet]     = useState<SheetId | null>(null)
  const [hotspot, setHotspot] = useState<HotspotId | null>(null)
  const webgl = useMemo(() => hasWebGL(), [])
  const mounted = tires.find(t => t.is_mounted)

  const canEdit = (id: SheetId) => {
    if (isOwner) return true
    const sec = SHEET_SECTION[id]
    return sec !== null && mySections.includes(sec)
  }

  const open  = (id: SheetId) => { setSheet(id); setHotspot(null) }
  const close = useCallback(() => { setSheet(null); setHotspot(null) }, [])
  const onHotspot = (id: HotspotId) => {
    setHotspot(id)
    // Kurz warten, damit die Kamera-Fahrt sichtbar ist, bevor das Blatt aufgeht
    window.setTimeout(() => setSheet(HOTSPOT_SHEET[id]), 550)
  }

  const tread = treadLevel(mounted)
  const levels: Partial<Record<HotspotId, Level>> = {
    'rad-vl': tread, 'rad-vr': tread, 'rad-hl': tread, 'rad-hr': tread,
    scheibe: dateLevel(vehicle.hu_due, 60),
    motor: worst(kmLevel(vehicle.current_mileage, vehicle.next_service_km), dateLevel(vehicle.next_service_date)),
  }

  const silhouette = <div className="qc-visual-loading"><CarSilhouette bodyType={vehicle.body_type} color={vehicle.color} className="w-4/5" /></div>
  const visual = webgl ? (
    <VisualBoundary fallback={silhouette}>
      <Suspense fallback={<div className="qc-visual-loading"><div /></div>}>
        <Car3D bodyType={vehicle.body_type} color={vehicle.color} plate={vehicle.license_plate}
          active={hotspot} levels={levels} onSelect={onHotspot} />
      </Suspense>
      <span className="qc-visual-hint">Drehen & Punkte antippen</span>
    </VisualBoundary>
  ) : silhouette

  const roleLabel = isOwner ? 'Besitzer' : mySections.length ? 'Fahrer · teilw. Bearbeitung' : 'Fahrer · nur lesen'
  const focusAxle = hotspot?.startsWith('rad-v') ? 'vorne' : hotspot?.startsWith('rad-h') ? 'hinten' : null
  const lastService = service[0]

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 safe-top safe-bottom">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Zurück"
          className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <span className="font-bold text-gray-900">Fahrzeug-Kartei</span>
        <div className="w-9" />
      </div>

      <main className="flex-1 px-4 py-5 space-y-4 max-w-xl w-full mx-auto">
        <QuartettCard vehicle={vehicle} code={data.code} mounted={mounted} roleLabel={roleLabel}
          visual={visual} activeSheet={sheet} onOpen={open} />

        <div className="qc-tiles">
          <button type="button" className="qc-tile" onClick={() => open('wartung')}>
            <Wrench size={18} className="text-brand-700" />
            <strong>Wartung</strong>
            <small>{lastService ? `zuletzt ${fmtDate(lastService.date)}` : 'keine Einträge'}</small>
          </button>
          <button type="button" className="qc-tile" onClick={() => open('notizen')}>
            <NotebookPen size={18} className="text-brand-700" />
            <strong>Notizen</strong>
            <small>{notes.length ? `${notes.length} ${notes.length === 1 ? 'Notiz' : 'Notizen'}` : 'keine'}</small>
          </button>
          {isOwner ? (
            <button type="button" className="qc-tile" onClick={() => open('fahrer')}>
              <Users size={18} className="text-brand-700" />
              <strong>Fahrer</strong>
              <small>{members.length ? `${members.length} freigegeben` : 'nur du'}</small>
            </button>
          ) : (
            <div className="qc-tile" style={{ cursor: 'default' }}>
              <Users size={18} className="text-gray-400" />
              <strong>Freigabe</strong>
              <small>{mySections.length ? mySections.map(s => SECTION_LABEL[s]).join(', ') : 'nur lesen'}</small>
            </div>
          )}
        </div>
      </main>

      {sheet && (
        <Sheet title={SHEET_TITLE[sheet]} onClose={close}
          badge={canEdit(sheet)
            ? <span className="qc-badge is-edit">bearbeitbar</span>
            : <span className="qc-badge">nur lesen</span>}>
          {sheet === 'daten'   && <DatenSheet   vehicle={vehicle} canEdit={canEdit('daten')}   onSaved={onChanged} />}
          {sheet === 'termine' && <TermineSheet vehicle={vehicle} canEdit={canEdit('termine')} onSaved={onChanged} />}
          {sheet === 'reifen'  && <ReifenSheet  vehicleId={vehicle.id} tires={tires} canEdit={canEdit('reifen')} focus={focusAxle} onChanged={onChanged} />}
          {sheet === 'wartung' && <WartungSheet vehicle={vehicle} entries={service} canEdit={canEdit('wartung')} onChanged={onChanged} />}
          {sheet === 'notizen' && <NotizenSheet vehicleId={vehicle.id} notes={notes} canEdit={canEdit('notizen')} userEmail={data.userEmail} onChanged={onChanged} />}
          {sheet === 'fahrer' && isOwner && <FahrerSheet vehicleId={vehicle.id} members={members} onChanged={onChanged} />}
        </Sheet>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Seite mit Datenzugriff
// ═════════════════════════════════════════════════════════════════════════

type LoadResult = { data: KarteiData; error: null } | { data: null; error: string }

async function loadKartei(vehicleId: string, userId: string, userEmail: string | null): Promise<LoadResult> {
  const [all, tires, service, notes, members] = await Promise.all([
    supabase.from('vehicles').select('*').order('model'),
    supabase.from('vehicle_tires').select('*').eq('vehicle_id', vehicleId).order('created_at'),
    supabase.from('vehicle_service_log').select('*').eq('vehicle_id', vehicleId).order('date', { ascending: false }),
    supabase.from('vehicle_notes').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
    supabase.from('vehicle_members').select('*').eq('vehicle_id', vehicleId),
  ])
  const firstError = [all, tires, service, notes, members].find(r => r.error)?.error
  if (firstError) {
    const missing = /does not exist|schema cache/i.test(firstError.message)
    return { data: null, error: missing
      ? 'Die Kartei-Tabellen fehlen noch in der Datenbank. Bitte die Migration „fahrzeug_kartei“ ausführen.'
      : firstError.message }
  }
  const list    = all.data ?? []
  const vehicle = list.find(v => v.id === vehicleId)
  if (!vehicle) return { data: null, error: 'Fahrzeug nicht gefunden oder keine Berechtigung.' }
  const isOwner   = vehicle.user_id === userId
  const sameClass = list.filter(v => v.body_type === vehicle.body_type)
  const memberRows = members.data ?? []
  return { error: null, data: {
    vehicle,
    code:       cardCode(vehicle, sameClass.findIndex(v => v.id === vehicle.id)),
    tires:      tires.data ?? [],
    service:    service.data ?? [],
    notes:      notes.data ?? [],
    members:    isOwner ? memberRows.filter(m => m.user_id !== userId) : [],
    isOwner,
    mySections: isOwner ? [] : memberRows.find(m => m.user_id === userId)?.editable_sections ?? [],
    userEmail,
  } }
}

export const VehicleCard: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [result, setResult]       = useState<LoadResult | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!vehicleId || !user) return
    let cancelled = false
    loadKartei(vehicleId, user.id, user.email ?? null)
      .then(r => { if (!cancelled) setResult(r) })
      .catch(err => { if (!cancelled) setResult({ data: null, error: String(err) }) })
    return () => { cancelled = true }
  }, [vehicleId, user, reloadKey])

  if (!result) {
    return (
      <div className="flex justify-center items-center h-dvh bg-gray-50">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!result.data) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-gray-50 px-6 text-center gap-4">
        <p className="text-gray-700">{result.error}</p>
        <button onClick={() => navigate('/garage')} className="px-5 py-3 rounded-2xl bg-brand-700 text-white font-bold">Zur Garage</button>
      </div>
    )
  }
  return <KarteiView data={result.data} onBack={() => navigate('/garage')} onChanged={() => setReloadKey(k => k + 1)} />
}
