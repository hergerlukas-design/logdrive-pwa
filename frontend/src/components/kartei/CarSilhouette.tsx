import type { BodyType } from '../../lib/database.types'
import { shade } from '../../lib/kartei'
import { CAR_SPECS, cabinProfile, insetConvex } from './carSpecs'

/** Leichte 2D-Seitenansicht – für die Garage-Übersicht und als Ersatz ohne WebGL */
export function CarSilhouette({ bodyType, color, className = '' }: { bodyType: BodyType; color: string; className?: string }) {
  const s     = CAR_SPECS[bodyType]
  const pad   = 0.25
  const w     = s.length + pad * 2
  const h     = s.clearance + s.bodyHeight + s.cabinHeight + pad * 1.4
  // SVG: y nach unten → umrechnen
  const X = (x: number) => x + s.length / 2 + pad
  const Y = (y: number) => h - pad * 0.6 - y
  const top = s.clearance + s.bodyHeight
  const prof = cabinProfile(s)
  let win = insetConvex(prof, 0.09)
  if (s.windowFromX !== undefined) win = win.map(([x, y]) => [Math.max(x, s.windowFromX!), y])
  const poly = (pts: [number, number][], dy: number) => pts.map(([x, y]) => `${X(x)},${Y(y + dy)}`).join(' ')
  const r = s.wheelRadius
  const gid = `paint-${bodyType}-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label="Fahrzeug-Silhouette">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.25)} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.35)} />
        </linearGradient>
      </defs>
      <ellipse cx={w / 2} cy={Y(0) + 0.02} rx={s.length * 0.55} ry={0.06} fill="#000" opacity="0.18" />
      <polygon points={poly(prof, top - 0.03)} fill={`url(#${gid})`} strokeLinejoin="round" stroke={shade(color, -0.3)} strokeWidth="0.02" />
      <polygon points={poly(win, top - 0.03)} fill="#0d1420" opacity="0.92" />
      <rect x={X(-s.length / 2)} y={Y(top)} width={s.length} height={s.bodyHeight} rx={Math.min(0.14, s.bodyHeight / 2)}
        fill={`url(#${gid})`} stroke={shade(color, -0.3)} strokeWidth="0.02" />
      <rect x={X(s.length / 2) - 0.05} y={Y(s.clearance + s.bodyHeight * 0.78)} width="0.06" height="0.1" rx="0.02" fill="#e8f1ff" />
      <rect x={X(-s.length / 2) - 0.01} y={Y(s.clearance + s.bodyHeight * 0.8)} width="0.06" height="0.1" rx="0.02" fill="#ff1a1a" />
      {[s.wheelbase / 2, -s.wheelbase / 2].map(x => (
        <g key={x}>
          <circle cx={X(x)} cy={Y(r)} r={r * 1.13} fill="#0b0b0c" />
          <circle cx={X(x)} cy={Y(r)} r={r} fill="#18181b" />
          <circle cx={X(x)} cy={Y(r)} r={r * 0.62} fill="#c9ccd1" />
          <circle cx={X(x)} cy={Y(r)} r={r * 0.14} fill="#2a2a2e" />
        </g>
      ))}
    </svg>
  )
}
