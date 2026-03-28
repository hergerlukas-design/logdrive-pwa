import { useState, useCallback } from 'react'
import { Button } from '../ui'
import { applyScanFilter } from '../../lib/imageProcessor'
import type { ExpenseType } from '../../lib/database.types'

export interface ReviewMeta {
  betrag:      string
  projekt:     string
  datum:       string
  zusatz:      string   // Kennzeichen
  expenseType: ExpenseType
  vehicleId:   string
  fileName:    string
  vehicleModel: string
}

interface Props {
  imageDataUrl: string
  meta:         ReviewMeta
  folderPath:   string
  onConfirm:    (finalFilename: string, imageDataUrl: string) => void
  onBack:       () => void
  uploading?:   boolean
  uploadError?: string | null
}

export default function ReviewCard({
  imageDataUrl, meta, folderPath, onConfirm, onBack,
  uploading = false, uploadError = null,
}: Props) {
  const [filename,   setFilename]   = useState(meta.fileName)
  const [editing,    setEditing]    = useState(false)
  const [scannedUrl, setScannedUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [filterOn,   setFilterOn]   = useState(false)

  const applyFilter = useCallback(async () => {
    if (!imageDataUrl) return
    setProcessing(true)
    try {
      const url = await applyScanFilter(imageDataUrl, { contrast: 1.8, brightness: 1.15, sharpen: true, threshold: false })
      setScannedUrl(url)
    } catch {
      setScannedUrl(imageDataUrl)
    } finally {
      setProcessing(false)
    }
  }, [imageDataUrl])

  const toggleFilter = async () => {
    if (!filterOn && !scannedUrl) await applyFilter()
    setFilterOn(v => !v)
  }

  const displayUrl = filterOn ? (scannedUrl ?? imageDataUrl) : imageDataUrl

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
        <button onClick={onBack} disabled={uploading}
          className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center disabled:opacity-40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="font-bold text-gray-900">Überprüfen</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Bild-Vorschau */}
        <div className="rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mx-auto relative"
          style={{ width: '70%', aspectRatio: '1 / 1.41' }}>
          {processing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 z-10">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Filter wird angewendet…</span>
            </div>
          )}
          {!processing && displayUrl && (
            <img src={displayUrl} alt="Beleg-Vorschau" className="w-full h-full object-contain" />
          )}
        </div>

        {/* Scan-Filter Toggle */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Scan-Filter</p>
            <p className="text-xs text-gray-400">Graustufen · Kontrast · Schärfe</p>
          </div>
          <button onClick={toggleFilter} disabled={processing}
            className={['relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-40',
              filterOn ? 'bg-brand-700' : 'bg-gray-200'].join(' ')}>
            <span className={['absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
              filterOn ? 'translate-x-6' : 'translate-x-0.5'].join(' ')} />
          </button>
        </div>

        {/* Metadaten */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <Row label="Betrag"       value={`${meta.betrag} €`} accent />
          <Row label="Typ"          value={meta.expenseType === 'tanken' ? '⛽ Tanken' : '⚡ Laden'} />
          <Row label="Fahrzeug"     value={`${meta.vehicleModel} · ${meta.zusatz}`} />
          <Row label="Projekt"      value={meta.projekt} />
          <Row label="Datum"        value={meta.datum} />
          <Row label="Dropbox"      value={folderPath} mono />
        </div>

        {/* Dateiname */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dateiname</p>
            <button onClick={() => setEditing(v => !v)} className="text-xs font-semibold text-brand-700">
              {editing ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>
          {editing
            ? <input autoFocus value={filename} onChange={e => setFilename(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                className="w-full px-4 py-3 rounded-xl border-2 border-brand-500 bg-white font-mono text-sm text-gray-900 outline-none" />
            : <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm text-gray-900 break-all">{filename}</div>
          }
          <p className="font-mono text-xs text-gray-400 mt-1.5 truncate">{folderPath}/{filename}</p>
        </div>

        {uploadError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              className="text-red-400 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        )}
      </div>

      <div className="px-5 py-4 bg-white border-t border-gray-200 space-y-3">
        <Button loading={uploading || processing} onClick={() => onConfirm(filename, displayUrl)}>
          {processing ? 'Filter wird angewendet…' : uploading ? 'Wird gespeichert…' : 'Ausgabe speichern'}
        </Button>
        {!uploading && !processing && (
          <Button variant="secondary" onClick={onBack}>Metadaten ändern</Button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, accent = false, mono = false }:
  { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-semibold text-gray-500">{label}</span>
      <span className={`text-sm ${accent ? 'font-bold text-gray-900' : 'text-gray-700'} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}
