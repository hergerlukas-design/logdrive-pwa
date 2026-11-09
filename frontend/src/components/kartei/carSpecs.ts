import type { BodyType } from '../../lib/database.types'

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
