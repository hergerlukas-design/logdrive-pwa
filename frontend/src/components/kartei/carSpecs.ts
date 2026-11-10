import type { BodyType } from '../../lib/database.types'
import type { HotspotId } from '../../lib/kartei'

/**
 * Maße der prozeduralen Fahrzeugmodelle (Meter, x = Längsachse, Front bei +x).
 * Wird vom 3D-Modell und von der 2D-Silhouette gemeinsam genutzt.
 */
export interface CarSpec {
  length:        number
  width:         number
  bodyHeight:    number   // Höhe des Unterbaus (Karosserie bis Gürtellinie)
  clearance:     number   // Bodenfreiheit
  wheelRadius:   number
  wheelbase:     number
  /** Kabinen-Profil (Seitenansicht): hinten unten, hinten oben, vorne oben, vorne unten */
  cabinRear:     number
  cabinRearTop:  number
  cabinFrontTop: number
  cabinFront:    number
  cabinHeight:   number
  /** Seitenfenster erst ab dieser x-Position (Transporter: nur Fahrerhaus verglast) */
  windowFromX?:  number
}

export const CAR_SPECS: Record<BodyType, CarSpec> = {
  kleinwagen: {
    length: 3.8, width: 1.72, bodyHeight: 0.56, clearance: 0.17, wheelRadius: 0.31, wheelbase: 2.45,
    cabinRear: -1.8, cabinRearTop: -1.55, cabinFrontTop: 0.25, cabinFront: 0.95, cabinHeight: 0.6,
  },
  limousine: {
    length: 4.7, width: 1.82, bodyHeight: 0.54, clearance: 0.15, wheelRadius: 0.33, wheelbase: 2.82,
    cabinRear: -1.65, cabinRearTop: -1.0, cabinFrontTop: 0.4, cabinFront: 1.15, cabinHeight: 0.56,
  },
  kombi: {
    length: 4.75, width: 1.82, bodyHeight: 0.55, clearance: 0.15, wheelRadius: 0.33, wheelbase: 2.82,
    cabinRear: -2.3, cabinRearTop: -2.12, cabinFrontTop: 0.4, cabinFront: 1.15, cabinHeight: 0.58,
  },
  suv: {
    length: 4.6, width: 1.9, bodyHeight: 0.74, clearance: 0.24, wheelRadius: 0.38, wheelbase: 2.75,
    cabinRear: -2.2, cabinRearTop: -1.98, cabinFrontTop: 0.35, cabinFront: 1.0, cabinHeight: 0.62,
  },
  transporter: {
    length: 5.25, width: 2.0, bodyHeight: 0.9, clearance: 0.2, wheelRadius: 0.36, wheelbase: 3.25,
    cabinRear: -2.6, cabinRearTop: -2.6, cabinFrontTop: 1.35, cabinFront: 1.95, cabinHeight: 1.15,
    windowFromX: 0.7,
  },
}

export function cabinProfile(s: CarSpec): [number, number][] {
  return [
    [s.cabinRear, 0],
    [s.cabinRearTop, s.cabinHeight],
    [s.cabinFrontTop, s.cabinHeight],
    [s.cabinFront, 0],
  ]
}

/** Konvexes Polygon (gegen den Uhrzeigersinn) um d nach innen versetzen */
export function insetConvex(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length
  // Orientierung bestimmen, damit „innen“ stimmt
  let area = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % n]
    area += x1 * y2 - x2 * y1
  }
  const sign = area > 0 ? 1 : -1
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n]
    const dx = q[0] - p[0], dy = q[1] - p[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * sign, ny = (dx / len) * sign // nach innen
    return { px: p[0] + nx * d, py: p[1] + ny * d, dx, dy }
  })
  return lines.map((a, i) => {
    const b = lines[(i + n - 1) % n]
    const det = a.dx * b.dy - a.dy * b.dx
    if (Math.abs(det) < 1e-9) return [a.px, a.py] as [number, number]
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / det
    return [a.px + a.dx * t, a.py + a.dy * t] as [number, number]
  })
}

// ── Hotspots (ohne three.js, auch für die 360°-Fotoansicht) ────────────────

type V3 = [number, number, number]
export interface HotspotPoint { id: HotspotId; pos: V3; normal: V3 }

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const sub  = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot  = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Mitte und Außennormale der Frontscheibe (Kabinenkante vorne unten → vorne oben) */
export function windshieldFrame(s: CarSpec) {
  const p = cabinProfile(s)
  const a = p[3], b = p[2]
  const dx = b[0] - a[0], dy = b[1] - a[1]
  let n = norm([dy, -dx, 0])
  if (n[1] < 0) n = [-n[0], -n[1], -n[2]]
  return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number], normal: n, len: Math.hypot(dx, dy) }
}

/** Fahrtrichtung +x, oben +y → rechts ist +z, links -z */
export function hotspotPoints(s: CarSpec): HotspotPoint[] {
  const top  = s.clearance + s.bodyHeight
  const half = s.wheelbase / 2
  const zW   = s.width / 2 + 0.06
  const ws   = windshieldFrame(s)
  return [
    { id: 'rad-vl', pos: [ half, s.wheelRadius, -zW], normal: [0, 0, -1] },
    { id: 'rad-vr', pos: [ half, s.wheelRadius,  zW], normal: [0, 0,  1] },
    { id: 'rad-hl', pos: [-half, s.wheelRadius, -zW], normal: [0, 0, -1] },
    { id: 'rad-hr', pos: [-half, s.wheelRadius,  zW], normal: [0, 0,  1] },
    { id: 'motor',  pos: [(s.cabinFront + s.length / 2) / 2, top + 0.04, 0], normal: norm([0.35, 1, 0]) },
    { id: 'scheibe', pos: [ws.mid[0] + ws.normal[0] * 0.08, ws.mid[1] + top + ws.normal[1] * 0.08, 0], normal: ws.normal },
    { id: 'kennzeichen', pos: [s.length / 2 + 0.08, s.clearance + s.bodyHeight * 0.32, 0], normal: norm([1, 0.15, 0]) },
    { id: 'heck',   pos: [-s.length / 2 - 0.06, s.clearance + s.bodyHeight * 0.78, 0], normal: norm([-1, 0.25, 0]) },
  ]
}

/** Position eines Hotspots im Foto: u/v = Anteil von Bildbreite/-höhe */
export interface SpinMarker { id: HotspotId; u: number; v: number; visible: number }

/**
 * Schätzt für jedes Foto einer 360°-Serie, wo die Hotspots im Bild liegen.
 * Annahmen (so leitet die Aufnahme an): gleichmäßige Schritte im Kreis, konstanter
 * Abstand, Kamera auf Brusthöhe, Fahrzeugmitte in Bildmitte, Seitenansicht füllt
 * ~80 % der Bildbreite. Foto `front` zeigt die Front, danach geht es zur rechten
 * Fahrzeugseite (bei `reverse` zur linken).
 */
export function projectSpinMarkers(s: CarSpec, frameCount: number, front: number, reverse: boolean, aspect: number): SpinMarker[][] {
  const points = hotspotPoints(s)
  const R      = Math.max(s.length * 1.05, 4.2)
  const camH   = 1.35
  const target: V3 = [0, (s.clearance + s.bodyHeight + s.cabinHeight) * 0.5, 0]
  const up: V3 = [0, 1, 0]

  const camera = (theta: number) => {
    const c: V3 = [R * Math.cos(theta), camH, R * Math.sin(theta)]
    const f = norm(sub(target, c))
    const r = norm(cross(f, up))
    const u = cross(r, f)
    const proj = (p: V3) => { const d = sub(p, c); const z = dot(d, f); return [dot(d, r) / z, dot(d, u) / z] as const }
    return { c, proj }
  }

  // Maßstab einmalig aus der Seitenansicht bestimmen (konstanter Abstand)
  const side = camera(Math.PI / 2)
  const xs = [-s.length / 2, s.length / 2].map(x => side.proj([x, target[1], 0])[0])
  const scale = 0.8 / Math.abs(xs[1] - xs[0])

  const dir = reverse ? -1 : 1
  return Array.from({ length: frameCount }, (_, i) => {
    const theta = dir * 2 * Math.PI * (((i - front) % frameCount + frameCount) % frameCount) / frameCount
    const cam = camera(theta)
    const [cx, cy] = cam.proj(target)
    return points.map(p => {
      const [x, y] = cam.proj(p.pos)
      const facing = dot(norm(sub(cam.c, p.pos)), p.normal)
      return {
        id: p.id,
        u: 0.5 + (x - cx) * scale,
        v: 0.52 - (y - cy) * scale * aspect,
        visible: facing > 0.12 ? Math.min(1, (facing - 0.12) * 4) : 0,
      }
    })
  })
}
