import React, { useState } from 'react'
import { Trash2, Plus, Check, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BodyType, FuelType, ServiceType, TireSeason, VehicleSection } from '../../lib/database.types'
import {
  BODY_TYPES, FUEL_LABEL, PAINT_COLORS, SEASON_LABEL, SEASON_ICON, SERVICE_LABEL, SERVICE_ICON, SECTION_LABEL,
  fmtNum, fmtDate, fmtMonth, relativeDays, dateLevel, kmLevel, treadLevel, consumptionUnit, numOrNull, strOrNull,
  type Vehicle, type VehicleUpdate, type TireSet, type TireInsert, type ServiceEntry, type VehicleNote, type VehicleMember, type Level,
} from '../../lib/kartei'
import { Field, KV, SaveBar, EditButton, Empty } from './Sheet'

type FormState = Record<string, string>
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function useForm(initial: FormState) {
  const [form, setForm] = useState<FormState>(initial)
  const bind = (key: string) => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })
  return { form, setForm, bind }
}

function useSubmit(fn: () => Promise<{ error: { message: string } | null } | void>, onDone?: () => void) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fn()
      if (res && res.error) { setError(res.error.message); return }
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

const LevelText: React.FC<{ level: Level; children: React.ReactNode }> = ({ level, children }) => (
  <span className={level === 'due' ? 'text-red-600' : level === 'warn' ? 'text-amber-600' : level === 'ok' ? 'text-green-700' : ''}>
    {children}
  </span>
)

/** Letzter Tag des Monats „YYYY-MM“ → „YYYY-MM-DD“ (HU gilt bis Monatsende) */
function monthEnd(ym: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

async function updateVehicle(id: string, patch: VehicleUpdate) {
  return supabase.from('vehicles').update(patch).eq('id', id)
}

// ═════════════════════════════════════════════════════════════════════════
// Fahrzeugdaten (nur Besitzer bearbeitet)
// ═════════════════════════════════════════════════════════════════════════

export function DatenSheet({ vehicle, canEdit, onSaved }: { vehicle: Vehicle; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const { form, setForm, bind } = useForm({
    model: vehicle.model, license_plate: vehicle.license_plate, body_type: vehicle.body_type, color: vehicle.color,
    fuel_type: s(vehicle.fuel_type), vin: s(vehicle.vin), first_registration: s(vehicle.first_registration),
    current_mileage: s(vehicle.current_mileage), power_ps: s(vehicle.power_ps), displacement_ccm: s(vehicle.displacement_ccm),
    top_speed_kmh: s(vehicle.top_speed_kmh), empty_weight_kg: s(vehicle.empty_weight_kg), consumption: s(vehicle.consumption),
  })
  const { busy, error, submit } = useSubmit(async () => {
    if (!form.model.trim() || !form.license_plate.trim()) throw new Error('Modell und Kennzeichen sind Pflicht.')
    const mileage = numOrNull(form.current_mileage)
    if (mileage === null || mileage < 0) throw new Error('Bitte einen gültigen Kilometerstand eintragen.')
    return updateVehicle(vehicle.id, {
      model: form.model.trim(), license_plate: form.license_plate.trim().toUpperCase(),
      body_type: form.body_type as BodyType, color: form.color,
      fuel_type: (form.fuel_type || null) as FuelType | null,
      vin: strOrNull(form.vin)?.toUpperCase() ?? null, first_registration: form.first_registration || null,
      current_mileage: mileage, power_ps: numOrNull(form.power_ps), displacement_ccm: numOrNull(form.displacement_ccm),
      top_speed_kmh: numOrNull(form.top_speed_kmh), empty_weight_kg: numOrNull(form.empty_weight_kg),
      consumption: numOrNull(form.consumption),
    })
  }, () => { setEditing(false); onSaved() })

  if (!editing) {
    return (
      <div>
        <div className="qc-card">
          <KV label="Modell" value={vehicle.model} />
          <KV label="Kennzeichen" value={<span className="font-mono">{vehicle.license_plate}</span>} />
          <KV label="Bauform" value={BODY_TYPES.find(b => b.value === vehicle.body_type)?.label} />
          <KV label="Antrieb" value={vehicle.fuel_type ? FUEL_LABEL[vehicle.fuel_type] : '–'} />
          <KV label="FIN" value={<span className="font-mono text-xs">{vehicle.vin ?? '–'}</span>} />
          <KV label="Erstzulassung" value={fmtDate(vehicle.first_registration)} />
          <KV label="Kilometerstand" value={fmtNum(vehicle.current_mileage, 'km')} />
        </div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-5 mb-2">Technik</p>
        <div className="qc-card">
          <KV label="Leistung" value={vehicle.power_ps !== null ? `${fmtNum(vehicle.power_ps, 'PS')} (${fmtNum(Math.round(vehicle.power_ps * 0.7355), 'kW')})` : '–'} />
          <KV label="Hubraum" value={fmtNum(vehicle.displacement_ccm, 'cm³')} />
          <KV label="Höchstgeschwindigkeit" value={fmtNum(vehicle.top_speed_kmh, 'km/h')} />
          <KV label="Leergewicht" value={fmtNum(vehicle.empty_weight_kg, 'kg')} />
          <KV label="Verbrauch" value={fmtNum(vehicle.consumption, consumptionUnit(vehicle), 1)} />
        </div>
        {canEdit && <EditButton onClick={() => setEditing(true)} />}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="qc-grid">
        <Field label="Modell" className="span-2"><input className="qc-input" required {...bind('model')} /></Field>
        <Field label="Kennzeichen"><input className="qc-input font-mono uppercase" required {...bind('license_plate')} /></Field>
        <Field label="Kilometerstand"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('current_mileage')} /></Field>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-600 mb-2">Bauform</p>
        <div className="flex flex-wrap gap-2">
          {BODY_TYPES.map(b => (
            <button key={b.value} type="button" onClick={() => setForm(f => ({ ...f, body_type: b.value }))}
              className={'px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ' +
                (form.body_type === b.value ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600')}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-600 mb-2">Lackfarbe</p>
        <div className="flex flex-wrap items-center gap-2">
          {PAINT_COLORS.map(c => (
            <button key={c} type="button" aria-label={`Farbe ${c}`} onClick={() => setForm(f => ({ ...f, color: c }))}
              className="w-8 h-8 rounded-full border-2 grid place-items-center"
              style={{ background: c, borderColor: form.color === c ? '#111' : 'rgba(0,0,0,0.1)' }}>
              {form.color === c && <Check size={14} color={c === '#f3f4f6' ? '#111' : '#fff'} strokeWidth={3} />}
            </button>
          ))}
          <input type="color" aria-label="Eigene Farbe" className="w-8 h-8 rounded-full overflow-hidden border-0 p-0 bg-transparent" {...bind('color')} />
        </div>
      </div>

      <div className="qc-grid">
        <Field label="Antrieb">
          <select className="qc-input" {...bind('fuel_type')}>
            <option value="">–</option>
            {Object.entries(FUEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Erstzulassung"><input className="qc-input" type="date" {...bind('first_registration')} /></Field>
        <Field label="FIN" className="span-2"><input className="qc-input font-mono uppercase" maxLength={17} {...bind('vin')} /></Field>
        <Field label="Leistung (PS)"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('power_ps')} /></Field>
        <Field label="Hubraum (cm³)"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('displacement_ccm')} /></Field>
        <Field label="Vmax (km/h)"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('top_speed_kmh')} /></Field>
        <Field label="Leergewicht (kg)"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('empty_weight_kg')} /></Field>
        <Field label={`Verbrauch (${consumptionUnit({ fuel_type: (form.fuel_type || null) as FuelType | null })})`} className="span-2">
          <input className="qc-input" inputMode="decimal" placeholder="z. B. 6,2" {...bind('consumption')} />
        </Field>
      </div>
      <SaveBar busy={busy} error={error} onCancel={() => setEditing(false)} />
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// HU & Termine (nur Besitzer bearbeitet)
// ═════════════════════════════════════════════════════════════════════════

export function TermineSheet({ vehicle, canEdit, onSaved }: { vehicle: Vehicle; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const { form, bind } = useForm({
    hu_due: vehicle.hu_due ? vehicle.hu_due.slice(0, 7) : '', next_service_date: s(vehicle.next_service_date),
    next_service_km: s(vehicle.next_service_km), service_interval_km: s(vehicle.service_interval_km),
    oil_type: s(vehicle.oil_type), insurance: s(vehicle.insurance), insurance_number: s(vehicle.insurance_number),
  })
  const { busy, error, submit } = useSubmit(async () => updateVehicle(vehicle.id, {
    hu_due: form.hu_due ? monthEnd(form.hu_due) : null,
    next_service_date: form.next_service_date || null,
    next_service_km: numOrNull(form.next_service_km), service_interval_km: numOrNull(form.service_interval_km),
    oil_type: strOrNull(form.oil_type), insurance: strOrNull(form.insurance), insurance_number: strOrNull(form.insurance_number),
  }), () => { setEditing(false); onSaved() })

  if (!editing) {
    const hu = dateLevel(vehicle.hu_due, 60)
    const kmLvl = kmLevel(vehicle.current_mileage, vehicle.next_service_km)
    const left = vehicle.next_service_km !== null ? vehicle.next_service_km - vehicle.current_mileage : null
    return (
      <div>
        <div className="qc-card">
          <KV label="HU / AU fällig" value={vehicle.hu_due
            ? <LevelText level={hu}>{fmtMonth(vehicle.hu_due)} <small className="font-medium">({relativeDays(vehicle.hu_due)})</small></LevelText> : '–'} />
          <KV label="Nächster Service" value={vehicle.next_service_date
            ? <LevelText level={dateLevel(vehicle.next_service_date)}>{fmtDate(vehicle.next_service_date)}</LevelText> : '–'} />
          <KV label="… oder bei" value={vehicle.next_service_km !== null
            ? <LevelText level={kmLvl}>{fmtNum(vehicle.next_service_km, 'km')} <small className="font-medium">({left! < 0 ? `${fmtNum(-left!)} km drüber` : `noch ${fmtNum(left)} km`})</small></LevelText> : '–'} />
          <KV label="Service-Intervall" value={fmtNum(vehicle.service_interval_km, 'km')} />
          <KV label="Motoröl" value={vehicle.oil_type ?? '–'} />
        </div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-5 mb-2">Versicherung</p>
        <div className="qc-card">
          <KV label="Versicherer" value={vehicle.insurance ?? '–'} />
          <KV label="Vertragsnummer" value={vehicle.insurance_number ?? '–'} />
        </div>
        {canEdit && <EditButton onClick={() => setEditing(true)} />}
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="qc-grid">
        <Field label="HU fällig (Monat)"><input className="qc-input" type="month" {...bind('hu_due')} /></Field>
        <Field label="Nächster Service am"><input className="qc-input" type="date" {...bind('next_service_date')} /></Field>
        <Field label="… oder bei km"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('next_service_km')} /></Field>
        <Field label="Intervall (km)"><input className="qc-input" type="number" inputMode="numeric" min={1} {...bind('service_interval_km')} /></Field>
        <Field label="Motoröl" className="span-2"><input className="qc-input" placeholder="z. B. 0W-30 VW 504.00" {...bind('oil_type')} /></Field>
        <Field label="Versicherer"><input className="qc-input" {...bind('insurance')} /></Field>
        <Field label="Vertragsnummer"><input className="qc-input" {...bind('insurance_number')} /></Field>
      </div>
      <SaveBar busy={busy} error={error} onCancel={() => setEditing(false)} />
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Reifen
// ═════════════════════════════════════════════════════════════════════════

function PressureBox({ label, normal, loaded, focus }: { label: string; normal: number | null; loaded: number | null; focus: boolean }) {
  return (
    <div className={'qc-pressure' + (focus ? ' is-focus' : '')}>
      <small>{label}</small>
      <b>{fmtNum(normal, '', 1)}</b>
      <small>bar{loaded !== null ? ` · beladen ${fmtNum(loaded, '', 1)}` : ''}</small>
    </div>
  )
}

function TireForm({ vehicleId, tire, onDone, onCancel }: {
  vehicleId: string; tire: TireSet | null; onDone: () => void; onCancel: () => void
}) {
  const { form, setForm, bind } = useForm({
    season: tire?.season ?? 'sommer', brand: s(tire?.brand), model: s(tire?.model), size: s(tire?.size),
    load_speed_index: s(tire?.load_speed_index), dot: s(tire?.dot), rim: s(tire?.rim),
    tread_depth_mm: s(tire?.tread_depth_mm), pressure_front_bar: s(tire?.pressure_front_bar),
    pressure_rear_bar: s(tire?.pressure_rear_bar), pressure_front_loaded_bar: s(tire?.pressure_front_loaded_bar),
    pressure_rear_loaded_bar: s(tire?.pressure_rear_loaded_bar), storage_location: s(tire?.storage_location), notes: s(tire?.notes),
  })
  const { busy, error, submit } = useSubmit(async () => {
    const row: TireInsert = {
      vehicle_id: vehicleId, season: form.season as TireSeason,
      brand: strOrNull(form.brand), model: strOrNull(form.model), size: strOrNull(form.size),
      load_speed_index: strOrNull(form.load_speed_index), dot: strOrNull(form.dot), rim: strOrNull(form.rim),
      tread_depth_mm: numOrNull(form.tread_depth_mm),
      pressure_front_bar: numOrNull(form.pressure_front_bar), pressure_rear_bar: numOrNull(form.pressure_rear_bar),
      pressure_front_loaded_bar: numOrNull(form.pressure_front_loaded_bar), pressure_rear_loaded_bar: numOrNull(form.pressure_rear_loaded_bar),
      storage_location: strOrNull(form.storage_location), notes: strOrNull(form.notes),
    }
    return tire
      ? supabase.from('vehicle_tires').update(row).eq('id', tire.id)
      : supabase.from('vehicle_tires').insert(row)
  }, onDone)

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        {(Object.keys(SEASON_LABEL) as TireSeason[]).map(k => (
          <button key={k} type="button" onClick={() => setForm(f => ({ ...f, season: k }))}
            className={'flex-1 py-2 rounded-xl text-sm font-semibold border-2 ' +
              (form.season === k ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600')}>
            {SEASON_ICON[k]} {SEASON_LABEL[k].replace('reifen', '')}
          </button>
        ))}
      </div>
      <div className="qc-grid">
        <Field label="Hersteller"><input className="qc-input" placeholder="z. B. Michelin" {...bind('brand')} /></Field>
        <Field label="Profil / Modell"><input className="qc-input" placeholder="z. B. Pilot Sport 5" {...bind('model')} /></Field>
        <Field label="Größe"><input className="qc-input font-mono" placeholder="225/45 R17" {...bind('size')} /></Field>
        <Field label="Last-/Speedindex"><input className="qc-input font-mono" placeholder="94W" {...bind('load_speed_index')} /></Field>
        <Field label="DOT (WWJJ)"><input className="qc-input font-mono" inputMode="numeric" maxLength={4} placeholder="2324" {...bind('dot')} /></Field>
        <Field label="Profiltiefe (mm)"><input className="qc-input" inputMode="decimal" placeholder="6,5" {...bind('tread_depth_mm')} /></Field>
        <Field label="Felge" className="span-2"><input className="qc-input" placeholder="z. B. Alu 7,5x17 ET45" {...bind('rim')} /></Field>
      </div>
      <p className="text-xs font-bold text-gray-600">Reifendruck (bar)</p>
      <div className="qc-grid">
        <Field label="Vorne"><input className="qc-input" inputMode="decimal" placeholder="2,4" {...bind('pressure_front_bar')} /></Field>
        <Field label="Hinten"><input className="qc-input" inputMode="decimal" placeholder="2,3" {...bind('pressure_rear_bar')} /></Field>
        <Field label="Vorne beladen"><input className="qc-input" inputMode="decimal" {...bind('pressure_front_loaded_bar')} /></Field>
        <Field label="Hinten beladen"><input className="qc-input" inputMode="decimal" {...bind('pressure_rear_loaded_bar')} /></Field>
        <Field label="Lagerort" className="span-2"><input className="qc-input" placeholder="z. B. Reifenhotel Müller" {...bind('storage_location')} /></Field>
        <Field label="Notiz" className="span-2"><textarea className="qc-input" rows={2} {...bind('notes')} /></Field>
      </div>
      <SaveBar busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}

export function ReifenSheet({ vehicleId, tires, canEdit, focus, onChanged }: {
  vehicleId: string; tires: TireSet[]; canEdit: boolean; focus: 'vorne' | 'hinten' | null; onChanged: () => void
}) {
  const [editing, setEditing] = useState<TireSet | 'new' | null>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const sorted = [...tires].sort((a, b) => Number(b.is_mounted) - Number(a.is_mounted))

  if (editing) {
    return <TireForm vehicleId={vehicleId} tire={editing === 'new' ? null : editing}
      onCancel={() => setEditing(null)} onDone={() => { setEditing(null); onChanged() }} />
  }

  const mount = async (t: TireSet) => {
    setBusyId(t.id); setError(null)
    // Erst alle abmontieren (eindeutiger Index erlaubt nur einen montierten Satz)
    const r1 = await supabase.from('vehicle_tires').update({ is_mounted: false }).eq('vehicle_id', vehicleId).eq('is_mounted', true)
    const r2 = r1.error ? r1 : await supabase.from('vehicle_tires').update({ is_mounted: true }).eq('id', t.id)
    setBusyId(null)
    if (r2.error) setError(r2.error.message); else onChanged()
  }
  const remove = async (t: TireSet) => {
    if (!confirm(`${SEASON_LABEL[t.season]} wirklich löschen?`)) return
    setBusyId(t.id)
    const { error } = await supabase.from('vehicle_tires').delete().eq('id', t.id)
    setBusyId(null)
    if (error) setError(error.message); else onChanged()
  }

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
      {sorted.length === 0 && <Empty>Noch keine Reifensätze hinterlegt.</Empty>}
      {sorted.map(t => {
        const tl = treadLevel(t)
        return (
          <div key={t.id} className={'qc-card' + (t.is_mounted ? ' is-mounted' : '')}>
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none">{SEASON_ICON[t.season]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{SEASON_LABEL[t.season]}</p>
                <p className="text-xs text-gray-500 truncate">{[t.brand, t.model].filter(Boolean).join(' ') || 'Hersteller unbekannt'}</p>
              </div>
              {t.is_mounted
                ? <span className="qc-badge is-edit">montiert</span>
                : t.storage_location && <span className="qc-badge">{t.storage_location}</span>}
            </div>

            {t.is_mounted && (
              <div className="qc-axle">
                <PressureBox label="Vorne links"  normal={t.pressure_front_bar} loaded={t.pressure_front_loaded_bar} focus={focus === 'vorne'} />
                <div className="qc-axle-car" aria-hidden />
                <PressureBox label="Vorne rechts" normal={t.pressure_front_bar} loaded={t.pressure_front_loaded_bar} focus={focus === 'vorne'} />
                <PressureBox label="Hinten links"  normal={t.pressure_rear_bar} loaded={t.pressure_rear_loaded_bar} focus={focus === 'hinten'} />
                <PressureBox label="Hinten rechts" normal={t.pressure_rear_bar} loaded={t.pressure_rear_loaded_bar} focus={focus === 'hinten'} />
              </div>
            )}

            <div className="mt-3">
              <KV label="Größe" value={<span className="font-mono">{[t.size, t.load_speed_index].filter(Boolean).join(' ') || '–'}</span>} />
              <KV label="Profiltiefe" value={<LevelText level={tl}>{fmtNum(t.tread_depth_mm, 'mm', 1)}</LevelText>} />
              <KV label="DOT" value={t.dot ? `KW ${t.dot.slice(0, 2)} / 20${t.dot.slice(2, 4)}` : '–'} />
              {!t.is_mounted && <KV label="Druck v / h" value={`${fmtNum(t.pressure_front_bar, '', 1)} / ${fmtNum(t.pressure_rear_bar, '', 1)} bar`} />}
              {t.rim && <KV label="Felge" value={t.rim} />}
              {t.notes && <KV label="Notiz" value={t.notes} />}
            </div>

            {canEdit && (
              <div className="flex gap-2 mt-3">
                {!t.is_mounted && (
                  <button type="button" disabled={busyId === t.id} onClick={() => mount(t)}
                    className="flex-1 py-2 rounded-xl bg-brand-700 text-white text-sm font-bold disabled:opacity-60">Montieren</button>
                )}
                <button type="button" onClick={() => setEditing(t)}
                  className="flex-1 py-2 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-bold">Bearbeiten</button>
                <button type="button" aria-label="Löschen" disabled={busyId === t.id} onClick={() => remove(t)}
                  className="w-10 py-2 rounded-xl border-2 border-red-200 text-red-600 grid place-items-center"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        )
      })}
      {canEdit && (
        <button type="button" onClick={() => setEditing('new')}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-600 font-bold flex items-center justify-center gap-2">
          <Plus size={18} /> Reifensatz hinzufügen
        </button>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Wartung
// ═════════════════════════════════════════════════════════════════════════

export function WartungSheet({ vehicle, entries, canEdit, onChanged }: {
  vehicle: Vehicle; entries: ServiceEntry[]; canEdit: boolean; onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const { form, bind, setForm } = useForm({
    type: 'oelwechsel', date: new Date().toISOString().slice(0, 10), mileage: s(vehicle.current_mileage),
    cost: '', workshop: '', description: '',
  })
  const add = useSubmit(async () => supabase.from('vehicle_service_log').insert({
    vehicle_id: vehicle.id, type: form.type as ServiceType, date: form.date,
    mileage: numOrNull(form.mileage), cost: numOrNull(form.cost),
    workshop: strOrNull(form.workshop), description: strOrNull(form.description),
  }), () => { setAdding(false); setForm(f => ({ ...f, cost: '', workshop: '', description: '' })); onChanged() })

  const remove = async (e: ServiceEntry) => {
    if (!confirm('Eintrag löschen?')) return
    const { error } = await supabase.from('vehicle_service_log').delete().eq('id', e.id)
    if (error) setError(error.message); else onChanged()
  }
  const total = entries.reduce((sum, e) => sum + (e.cost ?? 0), 0)

  if (adding) {
    return (
      <form onSubmit={add.submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SERVICE_LABEL) as ServiceType[]).map(k => (
            <button key={k} type="button" onClick={() => setForm(f => ({ ...f, type: k }))}
              className={'py-2 px-1 rounded-xl text-xs font-semibold border-2 ' +
                (form.type === k ? 'border-brand-700 bg-red-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600')}>
              <span className="block text-lg">{SERVICE_ICON[k]}</span>{SERVICE_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="qc-grid">
          <Field label="Datum"><input className="qc-input" type="date" required {...bind('date')} /></Field>
          <Field label="Kilometerstand"><input className="qc-input" type="number" inputMode="numeric" min={0} {...bind('mileage')} /></Field>
          <Field label="Kosten (€)"><input className="qc-input" inputMode="decimal" placeholder="0,00" {...bind('cost')} /></Field>
          <Field label="Werkstatt"><input className="qc-input" {...bind('workshop')} /></Field>
          <Field label="Beschreibung" className="span-2"><textarea className="qc-input" rows={3} {...bind('description')} /></Field>
        </div>
        <SaveBar busy={add.busy} error={add.error} onCancel={() => setAdding(false)} label="Eintragen" />
      </form>
    )
  }

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mb-3">{error}</div>}
      {entries.length > 0 && (
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-500">{entries.length} Einträge</span>
          <span className="font-bold text-gray-900">Gesamt {fmtNum(total, '€', 2)}</span>
        </div>
      )}
      {entries.length === 0 && <Empty>Noch keine Wartungen eingetragen.</Empty>}
      <ul className="qc-timeline">
        {entries.map(e => (
          <li key={e.id}>
            <div className="qc-card">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">{SERVICE_ICON[e.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{SERVICE_LABEL[e.type]}</p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(e.date)}{e.mileage !== null && ` · ${fmtNum(e.mileage, 'km')}`}{e.workshop && ` · ${e.workshop}`}
                  </p>
                </div>
                {e.cost !== null && <span className="font-bold text-gray-900 tabular-nums">{fmtNum(e.cost, '€', 2)}</span>}
              </div>
              {e.description && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{e.description}</p>}
              {canEdit && (
                <button type="button" onClick={() => remove(e)} className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1">
                  <Trash2 size={13} /> Löschen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl bg-brand-700 text-white font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
          <Plus size={18} /> Wartung eintragen
        </button>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Notizen
// ═════════════════════════════════════════════════════════════════════════

export function NotizenSheet({ vehicleId, notes, canEdit, userEmail, onChanged }: {
  vehicleId: string; notes: VehicleNote[]; canEdit: boolean; userEmail: string | null; onChanged: () => void
}) {
  const [body, setBody]   = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = useSubmit(async () => {
    if (!body.trim()) return
    return supabase.from('vehicle_notes').insert({ vehicle_id: vehicleId, body: body.trim(), author_email: userEmail })
  }, () => { setBody(''); onChanged() })
  const remove = async (n: VehicleNote) => {
    if (!confirm('Notiz löschen?')) return
    const { error } = await supabase.from('vehicle_notes').delete().eq('id', n.id)
    if (error) setError(error.message); else onChanged()
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <form onSubmit={add.submit} className="qc-card space-y-2">
          <textarea className="qc-input" rows={3} placeholder="z. B. Ersatzschlüssel liegt im Büro, Kratzer hinten links …"
            value={body} onChange={e => setBody(e.target.value)} />
          <SaveBar busy={add.busy} error={add.error} label="Notiz speichern" />
        </form>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
      {notes.length === 0 && <Empty>Keine Notizen.</Empty>}
      {notes.map(n => (
        <div key={n.id} className="qc-card">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{n.author_email ?? 'Unbekannt'} · {fmtDate(n.created_at)}</span>
            {canEdit && (
              <button type="button" aria-label="Notiz löschen" onClick={() => remove(n)} className="text-red-500"><Trash2 size={14} /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Fahrer & Rechte (nur Besitzer)
// ═════════════════════════════════════════════════════════════════════════

const ALL_SECTIONS = Object.keys(SECTION_LABEL) as VehicleSection[]

function SectionChips({ value, onToggle, disabled }: { value: VehicleSection[]; onToggle: (s: VehicleSection) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_SECTIONS.map(sec => {
        const on = value.includes(sec)
        return (
          <button key={sec} type="button" disabled={disabled} onClick={() => onToggle(sec)}
            className={'px-3 py-1.5 rounded-full text-xs font-bold border-2 flex items-center gap-1 transition-colors disabled:opacity-60 ' +
              (on ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-500')}>
            {on && <Check size={12} strokeWidth={3} />}{SECTION_LABEL[sec]}
          </button>
        )
      })}
    </div>
  )
}

export function FahrerSheet({ vehicleId, members, onChanged }: { vehicleId: string; members: VehicleMember[]; onChanged: () => void }) {
  const [email, setEmail]       = useState('')
  const [sections, setSections] = useState<VehicleSection[]>([])
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const toggle = (list: VehicleSection[], sec: VehicleSection) =>
    list.includes(sec) ? list.filter(x => x !== sec) : [...list, sec]

  const invite = useSubmit(async () => supabase.rpc('add_vehicle_member', {
    p_vehicle_id: vehicleId, p_email: email.trim(), p_sections: sections,
  }), () => { setEmail(''); setSections([]); onChanged() })

  const updateSections = async (m: VehicleMember, sec: VehicleSection) => {
    setBusyId(m.user_id); setError(null)
    const { error } = await supabase.from('vehicle_members')
      .update({ editable_sections: toggle(m.editable_sections, sec) })
      .eq('vehicle_id', vehicleId).eq('user_id', m.user_id)
    setBusyId(null)
    if (error) setError(error.message); else onChanged()
  }
  const remove = async (m: VehicleMember) => {
    if (!confirm(`Freigabe für ${m.email} entfernen?`)) return
    setBusyId(m.user_id)
    const { error } = await supabase.from('vehicle_members').delete().eq('vehicle_id', vehicleId).eq('user_id', m.user_id)
    setBusyId(null)
    if (error) setError(error.message); else onChanged()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Freigegebene Fahrer sehen die komplette Kartei. Bearbeiten dürfen sie nur die markierten Abschnitte.
        Fahrzeugdaten und Termine bleiben dir vorbehalten.
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}

      {members.length === 0 && <Empty>Noch keine Fahrer freigegeben.</Empty>}
      {members.map(m => (
        <div key={m.user_id} className="qc-card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-600 uppercase">{m.email[0]}</div>
            <p className="flex-1 min-w-0 font-semibold text-gray-900 truncate text-sm">{m.email}</p>
            <button type="button" aria-label="Freigabe entfernen" disabled={busyId === m.user_id} onClick={() => remove(m)}
              className="text-red-500 p-1"><Trash2 size={16} /></button>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Darf bearbeiten</p>
            <SectionChips value={m.editable_sections} disabled={busyId === m.user_id} onToggle={sec => updateSections(m, sec)} />
          </div>
        </div>
      ))}

      <form onSubmit={invite.submit} className="qc-card space-y-3">
        <p className="font-bold text-gray-900 flex items-center gap-2"><UserPlus size={16} /> Fahrer freigeben</p>
        <input className="qc-input" type="email" required placeholder="E-Mail des Fahrers" autoComplete="off"
          value={email} onChange={e => setEmail(e.target.value)} />
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Darf bearbeiten (optional)</p>
          <SectionChips value={sections} onToggle={sec => setSections(l => toggle(l, sec))} />
        </div>
        <SaveBar busy={invite.busy} error={invite.error} label="Freigeben" />
      </form>
    </div>
  )
}
