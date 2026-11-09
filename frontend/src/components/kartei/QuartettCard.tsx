import React from 'react'
import { Gauge, Cylinder, Zap, Weight, Fuel, Route, CircleDot, Ruler, CalendarCheck, Wrench, type LucideIcon } from 'lucide-react'
import {
  FUEL_LABEL, BODY_TYPES, GROUP_COLOR, worst, fmtNum, fmtMonth, dateLevel, kmLevel, treadLevel, consumptionUnit, isElectric,
  type Vehicle, type TireSet, type SheetId, type Level,
} from '../../lib/kartei'

interface StatRow {
  key:    string
  icon:   LucideIcon
  label:  string
  value:  React.ReactNode
  empty:  boolean
  sheet:  SheetId
  level?: Level
}

function buildStats(v: Vehicle, mounted: TireSet | undefined): StatRow[] {
  const elec = isElectric(v)
  const pressure = mounted && (mounted.pressure_front_bar !== null || mounted.pressure_rear_bar !== null)
    ? <>{fmtNum(mounted.pressure_front_bar, '', 1)} / {fmtNum(mounted.pressure_rear_bar, '', 1)}<small>bar</small></>
    : '–'
  const nextService = v.next_service_km !== null || v.next_service_date !== null
    ? [v.next_service_km !== null ? fmtNum(v.next_service_km, 'km') : null, v.next_service_date ? fmtMonth(v.next_service_date) : null].filter(Boolean).join(' · ')
    : '–'
  const serviceLevel = worst(kmLevel(v.current_mileage, v.next_service_km), dateLevel(v.next_service_date))

  return [
    { key: 'ps',     icon: Gauge,     label: 'Leistung',        sheet: 'daten', empty: v.power_ps === null,
      value: v.power_ps !== null ? <>{fmtNum(v.power_ps)}<small>PS</small></> : '–' },
    { key: 'ccm',    icon: elec ? Zap : Cylinder, label: elec ? 'Antrieb' : 'Hubraum', sheet: 'daten',
      empty: !elec && v.displacement_ccm === null,
      value: elec ? 'elektrisch' : v.displacement_ccm !== null ? <>{fmtNum(v.displacement_ccm)}<small>cm³</small></> : '–' },
    { key: 'vmax',   icon: Route,     label: 'Höchstgeschw.',   sheet: 'daten', empty: v.top_speed_kmh === null,
      value: v.top_speed_kmh !== null ? <>{fmtNum(v.top_speed_kmh)}<small>km/h</small></> : '–' },
    { key: 'kg',     icon: Weight,    label: 'Leergewicht',     sheet: 'daten', empty: v.empty_weight_kg === null,
      value: v.empty_weight_kg !== null ? <>{fmtNum(v.empty_weight_kg)}<small>kg</small></> : '–' },
    { key: 'verbr',  icon: Fuel,      label: 'Verbrauch',       sheet: 'daten', empty: v.consumption === null,
      value: v.consumption !== null ? <>{fmtNum(v.consumption, '', 1)}<small>{consumptionUnit(v)}</small></> : '–' },
    { key: 'km',     icon: Gauge,     label: 'Kilometerstand',  sheet: 'daten', empty: false,
      value: <>{fmtNum(v.current_mileage)}<small>km</small></> },
    { key: 'druck',  icon: CircleDot, label: 'Reifendruck v/h', sheet: 'reifen', empty: pressure === '–', value: pressure },
    { key: 'profil', icon: Ruler,     label: 'Profiltiefe',     sheet: 'reifen', empty: mounted?.tread_depth_mm == null,
      level: treadLevel(mounted),
      value: mounted?.tread_depth_mm != null ? <>{fmtNum(mounted.tread_depth_mm, '', 1)}<small>mm</small></> : '–' },
    { key: 'hu',     icon: CalendarCheck, label: 'HU fällig',   sheet: 'termine', empty: !v.hu_due,
      level: dateLevel(v.hu_due, 60), value: fmtMonth(v.hu_due) },
    { key: 'service', icon: Wrench,   label: 'Nächster Service', sheet: 'termine', empty: nextService === '–',
      level: serviceLevel, value: nextService },
  ]
}

export interface QuartettCardProps {
  vehicle:      Vehicle
  code:         string
  mounted?:     TireSet
  roleLabel:    string
  visual:       React.ReactNode
  activeSheet?: SheetId | null
  onOpen:       (sheet: SheetId) => void
}

export function QuartettCard({ vehicle, code, mounted, roleLabel, visual, activeSheet, onOpen }: QuartettCardProps) {
  const stats = buildStats(vehicle, mounted)
  const body  = BODY_TYPES.find(b => b.value === vehicle.body_type)?.label ?? ''
  return (
    <article className="qc" style={{ '--qc-group': GROUP_COLOR[vehicle.body_type] } as React.CSSProperties}>
      <div className="qc-inner">
        <header className="qc-head">
          <div className="qc-code" aria-label={`Karte ${code}`}>{code}</div>
          <div className="qc-title">
            <h2>{vehicle.model}</h2>
            <div className="qc-plate"><span>{vehicle.license_plate}</span></div>
          </div>
          {vehicle.fuel_type && <span className="qc-chip">{FUEL_LABEL[vehicle.fuel_type]}</span>}
        </header>

        <div className="qc-visual">
          {visual}
          <span className="qc-visual-tag">{body}</span>
        </div>

        <ul className="qc-stats">
          {stats.map(s => (
            <li key={s.key}>
              <button type="button" className={'qc-stat' + (activeSheet === s.sheet ? ' is-active' : '')} onClick={() => onOpen(s.sheet)}>
                <span className="qc-stat-icon"><s.icon size={15} strokeWidth={2.4} /></span>
                <span className="qc-stat-label">{s.label}</span>
                {s.level && s.level !== 'none' && <span className={`qc-dot lvl-${s.level}`} aria-hidden />}
                <span className={'qc-stat-value' + (s.empty ? ' is-empty' : '')}>{s.value}</span>
              </button>
            </li>
          ))}
        </ul>

        <footer className="qc-foot">
          <span>Fahrzeug-Kartei</span>
          <span>{roleLabel}</span>
        </footer>
      </div>
    </article>
  )
}
