import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Wrench, NotebookPen, Users, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VehicleSection } from '../lib/database.types'
import {
  HOTSPOT_SHEET, SHEET_TITLE, SHEET_SECTION, SECTION_LABEL, cardCode, dateLevel, kmLevel, treadLevel, fmtDate, worst,
  type Vehicle, type TireSet, type ServiceEntry, type VehicleNote, type VehicleMember, type VehicleSpin, type SheetId, type HotspotId, type Level,
} from '../lib/kartei'
import { QuartettCard } from '../components/kartei/QuartettCard'
import { CarSilhouette } from '../components/kartei/CarSilhouette'
import { Sheet } from '../components/kartei/Sheet'
import { SpinViewer } from '../components/kartei/SpinViewer'
import { loadSpinFrames } from '../lib/spin'
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
  spin:       VehicleSpin | null
  isOwner:    boolean
  /** Abschnitte, die der aktuelle Nutzer als Fahrer bearbeiten darf */
  mySections: VehicleSection[]
  userEmail:  string | null
}

/** Lädt die 360°-Fotos (Offline-Cache zuerst) und zeigt sie als Drehansicht */
function SpinVisual({ spin, vehicle, active, levels, onSelect }: {
  spin: VehicleSpin; vehicle: Vehicle; active: HotspotId | null
  levels: Partial<Record<HotspotId, Level>>; onSelect: (id: HotspotId) => void
}) {
  const [frames, setFrames]     = useState<string[] | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    let urls: string[] = []
    loadSpinFrames(spin, (d, t) => setProgress(d / t), ctrl.signal)
      .then(u => { urls = u; if (!ctrl.signal.aborted) setFrames(u) })
      .catch(err => { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err)) })
    return () => { ctrl.abort(); urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [spin])

  if (error) return <div className="qc-visual-loading text-xs text-gray-500 px-6 text-center">Fotos konnten nicht geladen werden: {error}</div>
  if (!frames) {
    return (
      <div className="qc-visual-loading">
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full bg-brand-700 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-gray-500">Lade 360°-Fotos …</span>
        </div>
      </div>
    )
  }
  return (
    <SpinViewer frames={frames} bodyType={vehicle.body_type} frontFrame={spin.front_frame} reverse={spin.reverse}
      aspect={Number(spin.aspect)} active={active} levels={levels} onSelect={onSelect} />
  )
}

export function KarteiView({ data, onBack, onChanged, onCapture }: {
  data: KarteiData; onBack: () => void; onChanged: () => void; onCapture?: () => void
}) {
  const { vehicle, tires, service, notes, members, isOwner, mySections } = data
  const [sheet, setSheet]     = useState<SheetId | null>(null)
  const [mode, setMode]       = useState<'fotos' | '3d'>(data.spin ? 'fotos' : '3d')
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
  const canPhoto = isOwner || mySections.includes('fotos')
  const showFotos = mode === 'fotos' && !!data.spin
  const model3d = webgl ? (
    <VisualBoundary fallback={silhouette}>
      <Suspense fallback={<div className="qc-visual-loading"><div /></div>}>
        <Car3D bodyType={vehicle.body_type} color={vehicle.color} plate={vehicle.license_plate}
          active={hotspot} levels={levels} onSelect={onHotspot} />
      </Suspense>
    </VisualBoundary>
  ) : silhouette
  const visual = (
    <>
      {showFotos && data.spin
        ? <SpinVisual spin={data.spin} vehicle={vehicle} active={hotspot} levels={levels} onSelect={onHotspot} />
        : model3d}
      {(showFotos || webgl) && <span className="qc-visual-hint">{showFotos ? 'Wischen & Punkte antippen' : 'Drehen & Punkte antippen'}</span>}
      {data.spin && (
        <div className="qc-seg" role="tablist" aria-label="Ansicht">
          <button type="button" role="tab" aria-selected={mode === 'fotos'} className={mode === 'fotos' ? 'is-on' : ''} onClick={() => setMode('fotos')}>Fotos</button>
          <button type="button" role="tab" aria-selected={mode === '3d'} className={mode === '3d' ? 'is-on' : ''} onClick={() => setMode('3d')}>3D</button>
        </div>
      )}
      {canPhoto && onCapture && (
        <button type="button" className="qc-visual-action" onClick={onCapture}
          aria-label={data.spin ? '360°-Fotos neu aufnehmen' : '360°-Fotos aufnehmen'}>
          <Camera size={15} strokeWidth={2.4} />
          {!data.spin && <span>360° aufnehmen</span>}
        </button>
      )}
    </>
  )

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
  // Optional: fehlt die Foto-Migration noch, bleibt die Kartei trotzdem nutzbar
  const spin = await supabase.from('vehicle_spins').select('*').eq('vehicle_id', vehicleId).maybeSingle()
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
    spin:       spin.error ? null : spin.data,
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
  return <KarteiView data={result.data} onBack={() => navigate('/garage')} onChanged={() => setReloadKey(k => k + 1)}
    onCapture={() => navigate(`/fahrzeuge/${vehicleId}/fotos`)} />
}
