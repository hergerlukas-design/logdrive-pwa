import { supabase } from './supabase'
import db from './db'
import type { VehicleSpin } from './kartei'

export const SPIN_BUCKET = 'vehicle-media'
/** Seitenverhältnis der gespeicherten Fotos (Querformat 4:3) */
export const SPIN_ASPECT = 4 / 3
const FRAME_WIDTH = 1280

export function spinPath(spin: Pick<VehicleSpin, 'vehicle_id' | 'id'>, file: string): string {
  return `${spin.vehicle_id}/${spin.id}/${file}`
}

// ── Bildaufbereitung ────────────────────────────────────────────────────────

/**
 * Schneidet ein Bild mittig auf 4:3-Querformat zu und speichert es als WebP
 * (Safari kann kein WebP erzeugen → JPEG).
 */
export async function encodeFrame(source: CanvasImageSource, srcW: number, srcH: number): Promise<Blob> {
  let cw = srcW, ch = srcW / SPIN_ASPECT
  if (ch > srcH) { ch = srcH; cw = srcH * SPIN_ASPECT }
  const sx = (srcW - cw) / 2, sy = (srcH - ch) / 2
  const outW = Math.min(FRAME_WIDTH, Math.round(cw))
  const outH = Math.round(outW / SPIN_ASPECT)

  const canvas = document.createElement('canvas')
  canvas.width = outW; canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, outW, outH)

  const toBlob = (type: string, q: number) => new Promise<Blob | null>(res => canvas.toBlob(res, type, q))
  const webp = await toBlob('image/webp', 0.8)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg', 0.84)
  if (!jpeg) throw new Error('Foto konnte nicht verarbeitet werden.')
  return jpeg
}

/** Datei aus der Galerie → aufbereitetes Foto */
export async function encodeFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try { return await encodeFrame(bitmap, bitmap.width, bitmap.height) }
  finally { bitmap.close() }
}

// ── Hochladen / Löschen ─────────────────────────────────────────────────────

export interface UploadOptions {
  vehicleId:  string
  frames:     Blob[]
  frontFrame: number
  reverse:    boolean
  onProgress?: (done: number, total: number) => void
}

/** Lädt eine neue Serie hoch, ersetzt die bisherige und räumt deren Dateien auf. */
export async function uploadSpin({ vehicleId, frames, frontFrame, reverse, onProgress }: UploadOptions): Promise<VehicleSpin> {
  const spinId = crypto.randomUUID()
  const files  = frames.map((b, i) => `${String(i).padStart(2, '0')}.${b.type === 'image/webp' ? 'webp' : 'jpg'}`)
  const bucket = supabase.storage.from(SPIN_BUCKET)

  let done = 0
  onProgress?.(0, frames.length)
  // Mit begrenzter Parallelität hochladen
  const queue = frames.map((blob, i) => ({ blob, i }))
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { error } = await bucket.upload(`${vehicleId}/${spinId}/${files[job.i]}`, job.blob, {
        contentType: job.blob.type, cacheControl: '31536000', upsert: false,
      })
      if (error) throw new Error(`Upload fehlgeschlagen (Foto ${job.i + 1}): ${error.message}`)
      onProgress?.(++done, frames.length)
    }
  }
  try {
    await Promise.all([worker(), worker(), worker()])
  } catch (err) {
    await bucket.remove(files.map(f => `${vehicleId}/${spinId}/${f}`)).catch(() => undefined)
    throw err
  }

  const { data: previous } = await supabase.from('vehicle_spins').select('*').eq('vehicle_id', vehicleId).maybeSingle()
  const { data, error } = await supabase.from('vehicle_spins').upsert({
    id: spinId, vehicle_id: vehicleId, frame_count: frames.length, files,
    front_frame: frontFrame, reverse, aspect: Number(SPIN_ASPECT.toFixed(3)),
  }, { onConflict: 'vehicle_id' }).select('*').single()
  if (error || !data) {
    await bucket.remove(files.map(f => `${vehicleId}/${spinId}/${f}`)).catch(() => undefined)
    throw new Error(error?.message ?? 'Speichern fehlgeschlagen.')
  }

  // Bereits verarbeitete Fotos direkt in den Offline-Cache legen
  const now = new Date().toISOString()
  await db.spinFrames.bulkPut(frames.map((blob, i) => ({ path: spinPath(data, files[i]), spinId, blob, cachedAt: now }))).catch(() => undefined)

  if (previous && previous.id !== spinId) await removeSpinFiles(previous)
  return data
}

async function removeSpinFiles(spin: VehicleSpin) {
  await supabase.storage.from(SPIN_BUCKET).remove(spin.files.map(f => spinPath(spin, f))).catch(() => undefined)
  await db.spinFrames.where('spinId').equals(spin.id).delete().catch(() => undefined)
}

export async function deleteSpin(spin: VehicleSpin): Promise<void> {
  const { error } = await supabase.from('vehicle_spins').delete().eq('id', spin.id)
  if (error) throw new Error(error.message)
  await removeSpinFiles(spin)
}

export async function updateSpinSettings(spin: VehicleSpin, patch: { front_frame?: number; reverse?: boolean }) {
  return supabase.from('vehicle_spins').update(patch).eq('id', spin.id)
}

// ── Laden mit Offline-Cache ─────────────────────────────────────────────────

async function frameBlob(path: string, spinId: string): Promise<Blob> {
  const cached = await db.spinFrames.get(path).catch(() => undefined)
  if (cached) return cached.blob
  const { data, error } = await supabase.storage.from(SPIN_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message ?? 'Foto nicht gefunden')
  await db.spinFrames.put({ path, spinId, blob: data, cachedAt: new Date().toISOString() }).catch(() => undefined)
  return data
}

/** Lädt alle Fotos einer Serie (Cache zuerst) und liefert Object-URLs in Aufnahme-Reihenfolge. */
export async function loadSpinFrames(spin: VehicleSpin, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<string[]> {
  const urls: string[] = new Array(spin.files.length)
  let done = 0
  const order = spin.files.map((_, i) => i)
  // Front-Foto zuerst, damit sofort etwas zu sehen ist
  order.sort((a, b) => (a === spin.front_frame ? -1 : b === spin.front_frame ? 1 : 0))
  const queue = [...order]
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      if (signal?.aborted) return
      const blob = await frameBlob(spinPath(spin, spin.files[i]), spin.id)
      urls[i] = URL.createObjectURL(blob)
      onProgress?.(++done, spin.files.length)
    }
  }
  try {
    await Promise.all([worker(), worker(), worker(), worker()])
  } catch (err) {
    urls.forEach(u => u && URL.revokeObjectURL(u))
    throw err
  }
  if (signal?.aborted) { urls.forEach(u => u && URL.revokeObjectURL(u)); return [] }
  return urls
}

/** Ein einzelnes Vorschaubild (z. B. ¾-Ansicht für die Garage) */
export async function loadSpinPoster(spin: VehicleSpin): Promise<string> {
  // ca. 45° nach der Front = ¾-Ansicht
  const step = Math.round(spin.frame_count / 8) * (spin.reverse ? -1 : 1)
  const i = ((spin.front_frame + step) % spin.frame_count + spin.frame_count) % spin.frame_count
  return URL.createObjectURL(await frameBlob(spinPath(spin, spin.files[i]), spin.id))
}
