import { jsPDF } from 'jspdf'
import type { Database, TripPurpose } from './database.types'

type Trip    = Database['public']['Tables']['trips']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

const A4_WIDTH_MM  = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM    = 10
const MAX_SIZE_BYTES = 950_000

// ── Fahrtenbuch PDF ──────────────────────────────────────────────────────────

export interface FahrtenbuchExportOptions {
  trips:      Trip[]
  vehicle:    Vehicle
  driverName: string
  year:       number
}

const PURPOSE_LABEL: Record<TripPurpose, string> = {
  dienstlich: 'Dienstlich',
  privat:     'Privat',
  arbeitsweg: 'Arbeitsweg',
}

export function buildFahrtenbuchPdf(opts: FahrtenbuchExportOptions): Blob {
  const { trips, vehicle, driverName, year } = opts
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })

  const PAGE_W  = 297
  const PAGE_H  = 210
  const ML      = 12   // margin left
  const MR      = 12   // margin right
  const MT      = 12   // margin top
  const TABLE_W = PAGE_W - ML - MR  // 273mm

  const formatDate = (d: string) => new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(d))

  const formatDateTime = (d: string) => new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))

  // Column definitions (widths in mm, must sum to TABLE_W = 273)
  const cols = [
    { key: 'nr',      label: 'Nr.',            w: 10  },
    { key: 'datum',   label: 'Datum & Uhrzeit', w: 38  },
    { key: 'von',     label: 'Von',             w: 45  },
    { key: 'nach',    label: 'Nach',            w: 45  },
    { key: 'startkm', label: 'Start-KM',        w: 22  },
    { key: 'endkm',   label: 'End-KM',          w: 22  },
    { key: 'strecke', label: 'Strecke',          w: 20  },
    { key: 'zweck',   label: 'Zweck',            w: 26  },
    { key: 'partner', label: 'Geschäftspartner', w: 45  },
  ]

  const ROW_H    = 7
  const HEADER_H = 8

  let page     = 1
  let y        = MT

  const addPageHeader = () => {
    // Title block
    doc.setFillColor(188, 1, 32)
    doc.rect(ML, y, TABLE_W, 8, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(`Fahrtenbuch ${year}  ·  ${vehicle.model}  ·  ${vehicle.license_plate}`, ML + 3, y + 5.5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fahrer: ${driverName}  |  Erstellt: ${formatDate(new Date().toISOString())}`, PAGE_W - MR - 3, y + 5.5, { align: 'right' })
    y += 10

    // Column headers
    doc.setFillColor(245, 245, 245)
    doc.rect(ML, y, TABLE_W, HEADER_H, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(ML, y, TABLE_W, HEADER_H)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    let x = ML
    for (const col of cols) {
      doc.text(col.label, x + 2, y + 5.5)
      x += col.w
    }
    y += HEADER_H
  }

  const addPageFooter = () => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Seite ${page}`, PAGE_W / 2, PAGE_H - 5, { align: 'center' })
    doc.text('Erstellt mit LogDrive', ML, PAGE_H - 5)
  }

  addPageHeader()

  // Summary stats
  const totalKm       = trips.reduce((s, t) => s + (t.end_km ? t.end_km - t.start_km : 0), 0)
  const dienstlichKm  = trips.filter(t => t.purpose === 'dienstlich').reduce((s, t) => s + (t.end_km ? t.end_km - t.start_km : 0), 0)
  const privatKm      = trips.filter(t => t.purpose === 'privat').reduce((s, t) => s + (t.end_km ? t.end_km - t.start_km : 0), 0)
  const arbeitswegKm  = trips.filter(t => t.purpose === 'arbeitsweg').reduce((s, t) => s + (t.end_km ? t.end_km - t.start_km : 0), 0)

  // Rows
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')

  trips.forEach((trip, i) => {
    // New page if needed
    if (y + ROW_H > PAGE_H - 20) {
      addPageFooter()
      doc.addPage()
      page++
      y = MT
      addPageHeader()
    }

    const isNachtrag = new Date(trip.timestamp).toDateString() !== new Date(trip.created_at).toDateString()
    const km = trip.end_km ? trip.end_km - trip.start_km : 0

    // Row background (alternating)
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(ML, y, TABLE_W, ROW_H, 'F')
    }

    // Row border
    doc.setDrawColor(230, 230, 230)
    doc.rect(ML, y, TABLE_W, ROW_H)

    const values: Record<string, string> = {
      nr:      String(i + 1),
      datum:   formatDateTime(trip.timestamp) + (isNachtrag ? ' *' : ''),
      von:     trip.start_location,
      nach:    trip.end_location ?? '—',
      startkm: trip.start_km.toLocaleString('de-DE'),
      endkm:   trip.end_km?.toLocaleString('de-DE') ?? '—',
      strecke: km.toLocaleString('de-DE') + ' km',
      zweck:   trip.purpose ? PURPOSE_LABEL[trip.purpose as TripPurpose] : '—',
      partner: trip.business_partner ?? '',
    }

    doc.setTextColor(30, 30, 30)
    let x = ML
    for (const col of cols) {
      const text = values[col.key] ?? ''
      // Clip text to column width
      const clipped = doc.splitTextToSize(text, col.w - 3)[0] ?? ''
      doc.text(clipped, x + 2, y + 4.8)
      x += col.w
    }

    y += ROW_H
  })

  // Summary box
  y += 6
  if (y + 20 > PAGE_H - 15) {
    addPageFooter()
    doc.addPage()
    page++
    y = MT
  }

  doc.setFillColor(245, 245, 245)
  doc.rect(ML, y, TABLE_W, 16, 'F')
  doc.setDrawColor(200, 200, 200)
  doc.rect(ML, y, TABLE_W, 16)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Zusammenfassung', ML + 3, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryItems = [
    `Gesamt: ${totalKm.toLocaleString('de-DE')} km`,
    `Dienstlich: ${dienstlichKm.toLocaleString('de-DE')} km`,
    `Arbeitsweg: ${arbeitswegKm.toLocaleString('de-DE')} km`,
    `Privat: ${privatKm.toLocaleString('de-DE')} km`,
    `Fahrten gesamt: ${trips.length}`,
  ]
  doc.text(summaryItems.join('   |   '), ML + 3, y + 12)

  if (trips.some(t => new Date(t.timestamp).toDateString() !== new Date(t.created_at).toDateString())) {
    y += 20
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('* Nachtrag: Eintrag wurde nach dem Fahrtdatum erfasst.', ML, y)
  }

  addPageFooter()
  return doc.output('blob')
}

export interface PdfMeta {
  betrag:  string
  projekt: string
  datum:   string
  zusatz?: string
}

export async function buildPdf(imageDataUrl: string, meta: PdfMeta): Promise<Blob> {
  let quality    = 0.7
  let pdfBlob: Blob | null = null
  let attempts   = 0
  const MAX_TRIES = 5

  while (attempts < MAX_TRIES) {
    const compressed = await compressImage(imageDataUrl, quality)
    pdfBlob          = await generatePdf(compressed, meta)
    if (pdfBlob.size <= MAX_SIZE_BYTES) break
    quality  -= 0.1
    attempts += 1
    if (quality < 0.2) {
      const resized = await resizeAndCompress(imageDataUrl, 0.5, 0.3)
      pdfBlob       = await generatePdf(resized, meta)
      break
    }
  }

  return pdfBlob!
}

async function generatePdf(imageDataUrl: string, meta: PdfMeta): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

  const FOOTER_HEIGHT_MM = 8
  const availableWidth   = A4_WIDTH_MM  - 2 * MARGIN_MM
  const availableHeight  = A4_HEIGHT_MM - 2 * MARGIN_MM - FOOTER_HEIGHT_MM

  const { width: imgW, height: imgH } = await getImageDimensions(imageDataUrl)
  const aspectRatio = imgH / imgW

  let renderWidth  = availableWidth
  let renderHeight = renderWidth * aspectRatio
  if (renderHeight > availableHeight) {
    renderHeight = availableHeight
    renderWidth  = renderHeight / aspectRatio
  }

  const xOffset = MARGIN_MM + (availableWidth  - renderWidth)  / 2
  const yOffset = MARGIN_MM + (availableHeight - renderHeight) / 2

  doc.addImage(imageDataUrl, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST')

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(buildFooterText(meta), MARGIN_MM, A4_HEIGHT_MM - 5)

  return doc.output('blob')
}

function compressImage(dataUrl: string, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img    = new Image()
    img.onload   = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

function resizeAndCompress(dataUrl: string, scaleFactor: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img    = new Image()
    img.onload   = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.naturalWidth  * scaleFactor)
      canvas.height = Math.round(img.naturalHeight * scaleFactor)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img    = new Image()
    img.onload   = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror  = () => reject(new Error('Bild konnte nicht geladen werden.'))
    img.src      = dataUrl
  })
}

function buildFooterText(meta: PdfMeta): string {
  const parts = [meta.betrag, meta.projekt, meta.datum]
  if (meta.zusatz) parts.push(meta.zusatz)
  return parts.join('  |  ')
}

export function buildFileName(meta: PdfMeta): string {
  const parts = [meta.betrag.trim(), meta.projekt.trim(), meta.datum.trim()]
  if (meta.zusatz?.trim()) parts.push(meta.zusatz.trim())
  return parts.join(' ') + '.pdf'
}
