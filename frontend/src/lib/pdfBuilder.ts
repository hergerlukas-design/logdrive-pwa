import { jsPDF } from 'jspdf'

const A4_WIDTH_MM  = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM    = 10
const MAX_SIZE_BYTES = 950_000

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
