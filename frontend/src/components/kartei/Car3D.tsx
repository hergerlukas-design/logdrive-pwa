import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, RoundedBox, ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { BodyType } from '../../lib/database.types'
import { HOTSPOT_LABEL, type HotspotId, type Level } from '../../lib/kartei'
import { CAR_SPECS, cabinProfile, insetConvex, hotspotPoints, type CarSpec } from './carSpecs'

export interface Car3DProps {
  bodyType:  BodyType
  color:     string
  plate:     string
  active:    HotspotId | null
  /** Warnstufe je Hotspot – färbt die Markierungen (z. B. HU fällig) */
  levels?:   Partial<Record<HotspotId, Level>>
  onSelect:  (id: HotspotId) => void
}

interface Hotspot { id: HotspotId; pos: THREE.Vector3; normal: THREE.Vector3 }

// ── Geometrie-Hilfen ────────────────────────────────────────────────────────

function edgeFrame(a: [number, number], b: [number, number], outward: 1 | -1) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  // outward = 1 → Normale zeigt nach vorne/oben (Frontscheibe), -1 → nach hinten/oben (Heckscheibe)
  const normal = outward === 1 ? new THREE.Vector3(dy, -dx, 0) : new THREE.Vector3(-dy, dx, 0)
  normal.normalize()
  if (normal.y < 0) normal.negate()
  return { mid: new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0), normal, len }
}

function hotspotsFor(s: CarSpec): Hotspot[] {
  return hotspotPoints(s).map(h => ({ id: h.id, pos: new THREE.Vector3(...h.pos), normal: new THREE.Vector3(...h.normal) }))
}

function usePlateTexture(text: string) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 520; c.height = 112
    const g = c.getContext('2d')!
    g.fillStyle = '#111'; g.beginPath(); g.roundRect(0, 0, 520, 112, 14); g.fill()
    g.fillStyle = '#fafafa'; g.beginPath(); g.roundRect(5, 5, 510, 102, 10); g.fill()
    g.fillStyle = '#1d4ed8'; g.beginPath(); g.roundRect(5, 5, 62, 102, [10, 0, 0, 10]); g.fill()
    g.fillStyle = '#facc15'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath(); g.arc(36 + Math.cos(a) * 17, 38 + Math.sin(a) * 17, 3, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'
    g.fillText('D', 36, 96)
    g.fillStyle = '#111'; g.font = 'bold 70px "DIN Alternate", "Arial Narrow", system-ui, sans-serif'
    g.textBaseline = 'middle'
    g.fillText(text || '—', 292, 60, 420)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

// ── Fahrzeug ────────────────────────────────────────────────────────────────

const isClick = (e: ThreeEvent<MouseEvent>) => e.delta <= 6

function Wheel({ spec, x, side, highlighted, onClick }: {
  spec: CarSpec; x: number; side: 1 | -1; highlighted: boolean; onClick: () => void
}) {
  const r  = spec.wheelRadius
  const tw = r * 0.68
  const z  = side * (spec.width / 2 - tw / 2 + 0.05)
  return (
    <group position={[x, r, z]}
      onClick={e => { if (!isClick(e)) return; e.stopPropagation(); onClick() }}
      onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}>
      {/* Radkasten */}
      <mesh position={[0, 0, side * (spec.width / 2 - z * side + 0.004)]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
        <circleGeometry args={[r * 1.13, 40, 0, Math.PI]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.9} />
      </mesh>
      {/* Reifen */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, tw, 40]} />
        <meshStandardMaterial color={highlighted ? '#3b0a12' : '#151517'} roughness={0.85}
          emissive={highlighted ? '#bc0120' : '#000'} emissiveIntensity={highlighted ? 0.45 : 0} />
      </mesh>
      {/* Felge */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * (tw / 2 + 0.002)]}>
        <cylinderGeometry args={[r * 0.66, r * 0.66, 0.02, 28]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Speichen */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, 0, side * (tw / 2 + 0.014)]} rotation={[0, 0, (i / 5) * Math.PI * 2]}>
          <boxGeometry args={[r * 0.11, r * 1.2, 0.012]} />
          <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * (tw / 2 + 0.022)]}>
        <cylinderGeometry args={[r * 0.14, r * 0.14, 0.02, 16]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

function CarModel({ spec, color, plate, active, onSelect }: {
  spec: CarSpec; color: string; plate: string; active: HotspotId | null; onSelect: (id: HotspotId) => void
}) {
  const top    = spec.clearance + spec.bodyHeight
  const cabinW = spec.width * (spec.windowFromX ? 0.97 : 0.84)
  const bevel  = 0.05
  const plateTex = usePlateTexture(plate)

  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({
    color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08,
  }), [color])
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d1420', metalness: 0.3, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide,
  }), [])
  const glassActive = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#5b0b16', emissive: '#bc0120', emissiveIntensity: 0.5, side: THREE.DoubleSide,
  }), [])
  useEffect(() => () => { paint.dispose(); glass.dispose(); glassActive.dispose() }, [paint, glass, glassActive])

  const { cabinGeo, windowGeo, windshield, rearWindow } = useMemo(() => {
    const prof  = cabinProfile(spec)
    const shape = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)))
    const cabinGeo = new THREE.ExtrudeGeometry(shape, {
      depth: cabinW - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 4,
    })
    cabinGeo.translate(0, 0, -(cabinW - bevel * 2) / 2)

    let win = insetConvex(prof, 0.09)
    if (spec.windowFromX !== undefined) win = win.map(([x, y]) => [Math.max(x, spec.windowFromX!), y])
    const windowGeo = new THREE.ShapeGeometry(new THREE.Shape(win.map(([x, y]) => new THREE.Vector2(x, y))))

    const ws = edgeFrame(prof[3], prof[2], 1)
    const rw = edgeFrame(prof[0], prof[1], -1)
    return { cabinGeo, windowGeo, windshield: ws, rearWindow: rw }
  }, [spec, cabinW])
  useEffect(() => () => { cabinGeo.dispose(); windowGeo.dispose() }, [cabinGeo, windowGeo])

  const select = (id: HotspotId) => (e: ThreeEvent<MouseEvent>) => {
    if (!isClick(e)) return
    e.stopPropagation(); onSelect(id)
  }
  const glow = (id: HotspotId) => active === id

  // Scheiben als Ebenen auf der Kabine, ausgerichtet an der jeweiligen Kante
  const pane = (f: ReturnType<typeof edgeFrame>, id: HotspotId | null) => {
    const obj = new THREE.Object3D()
    obj.position.copy(f.mid).addScaledVector(f.normal, bevel + 0.006)
    obj.lookAt(obj.position.clone().add(f.normal))
    return (
      <mesh position={obj.position} quaternion={obj.quaternion} material={id && glow(id) ? glassActive : glass}
        onClick={id ? select(id) : undefined}>
        <planeGeometry args={[cabinW * 0.86, f.len * 0.8]} />
      </mesh>
    )
  }

  const half = spec.wheelbase / 2
  return (
    <group>
      {/* Unterbau */}
      <RoundedBox args={[spec.length, spec.bodyHeight, spec.width]} radius={Math.min(0.14, spec.bodyHeight / 2 - 0.01)} smoothness={5}
        position={[0, spec.clearance + spec.bodyHeight / 2, 0]} material={paint} castShadow />

      {/* Motorhaube (klickbar, leicht hervorgehoben bei Auswahl) */}
      <mesh position={[(spec.cabinFront + spec.length / 2) / 2 - 0.05, top + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}
        onClick={select('motor')}>
        <planeGeometry args={[spec.length / 2 - spec.cabinFront - 0.15, spec.width * 0.8]} />
        <meshStandardMaterial color="#bc0120" transparent opacity={glow('motor') ? 0.35 : 0} depthWrite={false} />
      </mesh>

      {/* Kabine */}
      <mesh geometry={cabinGeo} material={paint} position={[0, top - 0.03, 0]} castShadow />
      <mesh geometry={windowGeo} material={glass} position={[0, top - 0.03, cabinW / 2 + 0.004]} />
      <mesh geometry={windowGeo} material={glass} position={[0, top - 0.03, -cabinW / 2 - 0.004]} />
      <group position={[0, top - 0.03, 0]}>
        {pane(windshield, 'scheibe')}
        {spec.windowFromX === undefined && pane(rearWindow, null)}
      </group>

      {/* Außenspiegel */}
      {[1, -1].map(side => (
        <mesh key={side} position={[spec.cabinFront - 0.12, top + 0.12, side * (cabinW / 2 + 0.1)]} material={paint}>
          <boxGeometry args={[0.1, 0.1, 0.16]} />
        </mesh>
      ))}

      {/* Scheinwerfer & Grill */}
      {[1, -1].map(side => (
        <mesh key={side} position={[spec.length / 2 + 0.002, spec.clearance + spec.bodyHeight * 0.72, side * spec.width * 0.32]}>
          <boxGeometry args={[0.04, 0.1, spec.width * 0.24]} />
          <meshStandardMaterial color="#fff" emissive="#e8f1ff" emissiveIntensity={1.2} />
        </mesh>
      ))}
      <mesh position={[spec.length / 2 + 0.004, spec.clearance + spec.bodyHeight * 0.62, 0]}>
        <boxGeometry args={[0.03, spec.bodyHeight * 0.22, spec.width * 0.34]} />
        <meshStandardMaterial color="#0e0e10" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Rückleuchten */}
      {[1, -1].map(side => (
        <mesh key={side} position={[-spec.length / 2 - 0.002, spec.clearance + spec.bodyHeight * 0.74, side * spec.width * 0.36]}>
          <boxGeometry args={[0.04, 0.09, spec.width * 0.2]} />
          <meshStandardMaterial color="#7f1d1d" emissive="#ff1a1a" emissiveIntensity={glow('heck') ? 2.4 : 1} />
        </mesh>
      ))}
      {/* Heckklappe (Klickfläche) */}
      <mesh position={[-spec.length / 2 - 0.004, spec.clearance + spec.bodyHeight * 0.55, 0]} rotation={[0, -Math.PI / 2, 0]}
        onClick={select('heck')}>
        <planeGeometry args={[spec.width * 0.5, spec.bodyHeight * 0.5]} />
        <meshStandardMaterial color="#bc0120" transparent opacity={glow('heck') ? 0.3 : 0} depthWrite={false} />
      </mesh>

      {/* Stoßfänger */}
      {[1, -1].map(side => (
        <mesh key={side} position={[side * (spec.length / 2 + 0.01), spec.clearance + 0.07, 0]}>
          <boxGeometry args={[0.06, 0.12, spec.width * 0.94]} />
          <meshStandardMaterial color="#1a1a1d" roughness={0.7} />
        </mesh>
      ))}

      {/* Kennzeichen vorne & hinten */}
      {[1, -1].map(side => (
        <mesh key={side} position={[side * (spec.length / 2 + 0.045), spec.clearance + spec.bodyHeight * 0.32, 0]}
          rotation={[0, side * Math.PI / 2, 0]} onClick={select('kennzeichen')}>
          <planeGeometry args={[0.52, 0.112]} />
          <meshStandardMaterial map={plateTex} roughness={0.4}
            emissive={glow('kennzeichen') ? '#bc0120' : '#000'} emissiveIntensity={glow('kennzeichen') ? 0.35 : 0} />
        </mesh>
      ))}

      {/* Räder */}
      <Wheel spec={spec} x={ half} side={-1} highlighted={glow('rad-vl')} onClick={() => onSelect('rad-vl')} />
      <Wheel spec={spec} x={ half} side={ 1} highlighted={glow('rad-vr')} onClick={() => onSelect('rad-vr')} />
      <Wheel spec={spec} x={-half} side={-1} highlighted={glow('rad-hl')} onClick={() => onSelect('rad-hl')} />
      <Wheel spec={spec} x={-half} side={ 1} highlighted={glow('rad-hr')} onClick={() => onSelect('rad-hr')} />
    </group>
  )
}

// ── Markierungen & Kamera ───────────────────────────────────────────────────

/** DOM-Markierung direkt verschieben (außerhalb von React, läuft jedes Frame) */
function placeMarker(el: HTMLElement, x: number, y: number, opacity: number) {
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
  el.style.opacity = String(opacity)
  el.style.pointerEvents = opacity > 0 ? 'auto' : 'none'
}

type MarkerRefs = React.RefObject<Partial<Record<HotspotId, HTMLButtonElement | null>>>

/**
 * Projiziert die Hotspots jedes Frame auf den Bildschirm und schiebt die
 * DOM-Markierungen (außerhalb des Canvas) dorthin. Abgewandte Punkte werden ausgeblendet.
 */
function MarkerProjector({ hotspots, refs }: { hotspots: Hotspot[]; refs: MarkerRefs }) {
  const v   = useMemo(() => new THREE.Vector3(), [])
  const toC = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const h of hotspots) {
      const el = refs.current?.[h.id]
      if (!el) continue
      v.copy(h.pos).project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      const facing = toC.copy(camera.position).sub(h.pos).normalize().dot(h.normal)
      const visible = facing > 0.08 && v.z < 1
      placeMarker(el, x, y, visible ? Math.min(1, facing * 3) : 0)
    }
  })
  return null
}

function CameraRig({ spec, focus, controls }: {
  spec: CarSpec; focus: Hotspot | null; controls: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const goal    = useRef<THREE.Vector3 | null>(null)
  const dist    = spec.length * 1.75

  useEffect(() => {
    if (!focus) { goal.current = null; return }
    const dir = focus.normal.clone().setY(Math.max(focus.normal.y, 0) + 0.45).normalize()
    // Bei Rädern leicht schräg von vorne/hinten, damit Rad & Karosserie sichtbar bleiben
    if (focus.id.startsWith('rad')) dir.x += focus.pos.x > 0 ? 0.55 : -0.55
    goal.current = dir.normalize().multiplyScalar(dist).add(new THREE.Vector3(0, 0.5, 0))
  }, [focus, dist])

  useFrame((_, delta) => {
    const c = controls.current
    if (!goal.current || !c) return
    camera.position.lerp(goal.current, 1 - Math.exp(-delta * 4))
    c.update()
    if (camera.position.distanceTo(goal.current) < 0.02) goal.current = null
  })
  return null
}

function Scene({ bodyType, color, plate, active, onSelect, markerRefs }: Car3DProps & { markerRefs: MarkerRefs }) {
  const spec     = CAR_SPECS[bodyType]
  const hotspots = useMemo(() => hotspotsFor(spec), [spec])
  const focus    = hotspots.find(h => h.id === active) ?? null
  const controls = useRef<OrbitControlsImpl | null>(null)
  const [interacted, setInteracted] = useState(false)

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 7, 3]} intensity={1.6} castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer intensity={1.2} position={[6, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer intensity={1.2} position={[-6, 1.5, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer intensity={0.8} position={[0, 1, 6]} scale={[10, 1.5, 1]} color="#ffd9de" />
      </Environment>

      <CarModel spec={spec} color={color} plate={plate} active={active} onSelect={onSelect} />
      <MarkerProjector hotspots={hotspots} refs={markerRefs} />
      <ContactShadows position={[0, 0.001, 0]} scale={spec.length * 2.2} blur={2.4} opacity={0.55} far={2} resolution={512} />

      <OrbitControls
        ref={controls}
        target={[0, spec.clearance + spec.bodyHeight * 0.8, 0]}
        enablePan={false}
        minDistance={spec.length * 1.15}
        maxDistance={spec.length * 2.6}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.49}
        autoRotate={!active && !interacted}
        autoRotateSpeed={0.9}
        enableDamping
        onStart={() => setInteracted(true)}
      />
      <CameraRig spec={spec} focus={focus} controls={controls} />
    </>
  )
}

const HOTSPOT_IDS = Object.keys(HOTSPOT_LABEL) as HotspotId[]

export default function Car3D(props: Car3DProps) {
  const spec = CAR_SPECS[props.bodyType]
  const d = spec.length * 1.75
  const markerRefs = useRef<Partial<Record<HotspotId, HTMLButtonElement | null>>>({})
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [d * 0.72, d * 0.38, d * 0.62], fov: 30, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onPointerMissed={() => { document.body.style.cursor = '' }}
      >
        <Scene {...props} markerRefs={markerRefs} />
      </Canvas>
      {/* Markierungen als normale Buttons über dem Canvas (Position setzt MarkerProjector) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {HOTSPOT_IDS.map(id => (
          <button
            key={id}
            ref={el => { markerRefs.current[id] = el }}
            type="button"
            aria-label={HOTSPOT_LABEL[id]}
            title={HOTSPOT_LABEL[id]}
            onClick={() => props.onSelect(id)}
            className={['qc-hotspot', props.active === id ? 'is-active' : '', `lvl-${props.levels?.[id] ?? 'none'}`].join(' ')}
            style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  )
}
