import type {
  Database, BodyType, FuelType, TireSeason, ServiceType, VehicleSection,
} from './database.types'

export type Vehicle       = Database['public']['Tables']['vehicles']['Row']
export type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']
export type TireSet       = Database['public']['Tables']['vehicle_tires']['Row']
export type TireInsert    = Database['public']['Tables']['vehicle_tires']['Insert']
export type ServiceEntry  = Database['public']['Tables']['vehicle_service_log']['Row']
export type VehicleNote   = Database['public']['Tables']['vehicle_notes']['Row']
export type VehicleMember = Database['public']['Tables']['vehicle_members']['Row']
export type VehicleSpin   = Database['public']['Tables']['vehicle_spins']['Row']

/** Bereiche der Kartei – jeder öffnet ein eigenes Detail-Blatt */
export type SheetId = 'daten' | 'termine' | 'reifen' | 'wartung' | 'notizen' | 'fahrer'

/** Klickbare Punkte am 3D-Modell */
export type HotspotId =
  | 'rad-vl' | 'rad-vr' | 'rad-hl' | 'rad-hr'
  | 'motor' | 'scheibe' | 'kennzeichen' | 'heck'

export const HOTSPOT_SHEET: Record<HotspotId, SheetId> = {
  'rad-vl': 'reifen', 'rad-vr': 'reifen', 'rad-hl': 'reifen', 'rad-hr': 'reifen',
  motor:       'wartung',
  scheibe:     'termine',
  kennzeichen: 'daten',
  heck:        'notizen',
}

export const HOTSPOT_LABEL: Record<HotspotId, string> = {
  'rad-vl': 'Reifen vorne links', 'rad-vr': 'Reifen vorne rechts',
  'rad-hl': 'Reifen hinten links', 'rad-hr': 'Reifen hinten rechts',
  motor: 'Motor & Wartung', scheibe: 'HU & Termine', kennzeichen: 'Fahrzeugdaten', heck: 'Notizen',
}

export const SHEET_TITLE: Record<SheetId, string> = {
  daten: 'Fahrzeugdaten', termine: 'HU & Termine', reifen: 'Reifen',
  wartung: 'Wartung', notizen: 'Notizen', fahrer: 'Fahrer & Rechte',
}

/** Welche Freigabe braucht ein Fahrer, um ein Blatt zu bearbeiten? (null = nur Besitzer) */
export const SHEET_SECTION: Record<SheetId, VehicleSection | null> = {
  daten: null, termine: null, fahrer: null,
  reifen: 'reifen', wartung: 'wartung', notizen: 'notizen',
}

export const SECTION_LABEL: Record<VehicleSection, string> = {
  reifen: 'Reifen', wartung: 'Wartung', notizen: 'Notizen', fotos: '360°-Fotos',
}

export const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'kleinwagen',  label: 'Kleinwagen' },
  { value: 'limousine',   label: 'Limousine' },
  { value: 'kombi',       label: 'Kombi' },
  { value: 'suv',         label: 'SUV' },
  { value: 'transporter', label: 'Transporter' },
]

export const FUEL_LABEL: Record<FuelType, string> = {
  benzin: 'Benzin', diesel: 'Diesel', elektro: 'Elektro', hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid', gas: 'Gas (LPG/CNG)', wasserstoff: 'Wasserstoff',
}

export const SEASON_LABEL: Record<TireSeason, string> = {
  sommer: 'Sommerreifen', winter: 'Winterreifen', ganzjahr: 'Ganzjahresreifen',
}
export const SEASON_ICON: Record<TireSeason, string> = { sommer: '☀️', winter: '❄️', ganzjahr: '🌦️' }

export const SERVICE_LABEL: Record<ServiceType, string> = {
  oelwechsel: 'Ölwechsel', inspektion: 'Inspektion', reifenwechsel: 'Reifenwechsel',
  hu: 'HU / AU', reparatur: 'Reparatur', sonstiges: 'Sonstiges',
}
export const SERVICE_ICON: Record<ServiceType, string> = {
  oelwechsel: '🛢️', inspektion: '🔧', reifenwechsel: '🛞', hu: '📋', reparatur: '🔩', sonstiges: '📝',
}

/** Rahmenfarbe der Quartett-Karte je Fahrzeugklasse */
export const GROUP_COLOR: Record<BodyType, string> = {
  kleinwagen: '#bc0120', limousine: '#1e40af', kombi: '#047857', suv: '#b45309', transporter: '#6b21a8',
}

export const PAINT_COLORS = [
  '#bc0120', '#111827', '#f3f4f6', '#9ca3af', '#1e3a8a', '#0e7490', '#166534', '#ca8a04', '#ea580c', '#6b21a8',
]

// ── Formatierung ────────────────────────────────────────────────────────────

const nf = (digits = 0) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function fmtNum(n: number | null | undefined, unit = '', digits = 0): string {
  if (n === null || n === undefined) return '–'
  return `${nf(digits).format(n)}${unit ? ' ' + unit : ''}`
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  if (!iso) return '–'
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('de-DE', opts)
}

export function fmtMonth(iso: string | null | undefined): string {
  return fmtDate(iso, { month: '2-digit', year: 'numeric' })
}

/** Tage bis zu einem Datum (negativ = überfällig) */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso + 'T00:00:00').getTime()
  const today  = new Date(new Date().toDateString()).getTime()
  return Math.round((target - today) / 86_400_000)
}

export type Level = 'ok' | 'warn' | 'due' | 'none'

export function dateLevel(iso: string | null | undefined, warnDays = 30): Level {
  const d = daysUntil(iso)
  if (d === null) return 'none'
  if (d < 0) return 'due'
  if (d <= warnDays) return 'warn'
  return 'ok'
}

const LEVEL_ORDER: Level[] = ['none', 'ok', 'warn', 'due']
/** Schlechteste von mehreren Warnstufen */
export function worst(...levels: Level[]): Level {
  return levels.reduce<Level>((a, b) => (LEVEL_ORDER.indexOf(b) > LEVEL_ORDER.indexOf(a) ? b : a), 'none')
}

export function kmLevel(current: number, next: number | null | undefined, warnKm = 1000): Level {
  if (next === null || next === undefined) return 'none'
  const left = next - current
  if (left < 0) return 'due'
  if (left <= warnKm) return 'warn'
  return 'ok'
}

/** Profiltiefe: < 1,6 mm gesetzlich zu wenig, < 3 mm (Sommer) bzw. < 4 mm (Winter) empfohlen wechseln */
export function treadLevel(tire: TireSet | undefined): Level {
  if (!tire || tire.tread_depth_mm === null) return 'none'
  if (tire.tread_depth_mm < 1.6) return 'due'
  if (tire.tread_depth_mm < (tire.season === 'sommer' ? 3 : 4)) return 'warn'
  return 'ok'
}

export function relativeDays(iso: string | null | undefined): string {
  const d = daysUntil(iso)
  if (d === null) return ''
  if (d === 0) return 'heute'
  if (d < 0) return `seit ${-d} ${-d === 1 ? 'Tag' : 'Tagen'} überfällig`
  if (d < 60) return `in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`
  return `in ${Math.round(d / 30)} Monaten`
}

/** Karten-Code im Quartett-Stil, z. B. „B3“: Buchstabe = Klasse, Ziffer = Position */
export function cardCode(vehicle: Pick<Vehicle, 'body_type'>, index: number): string {
  const letter = { kleinwagen: 'A', limousine: 'B', kombi: 'C', suv: 'D', transporter: 'E' }[vehicle.body_type] ?? 'X'
  return `${letter}${index + 1}`
}

export function isElectric(v: Pick<Vehicle, 'fuel_type'>): boolean {
  return v.fuel_type === 'elektro'
}

export function consumptionUnit(v: Pick<Vehicle, 'fuel_type'>): string {
  return isElectric(v) ? 'kWh/100 km' : v.fuel_type === 'wasserstoff' ? 'kg/100 km' : 'l/100 km'
}

/** Leere Eingaben → null, Zahlen-Strings → number */
export function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
export function strOrNull(v: string): string | null {
  return v.trim() === '' ? null : v.trim()
}

/** Hex-Farbe aufhellen/abdunkeln (für Karten-Akzente) */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = (shift: number) => {
    const c = (n >> shift) & 255
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  }
  return `#${ch(16)}${ch(8)}${ch(0)}`
}
