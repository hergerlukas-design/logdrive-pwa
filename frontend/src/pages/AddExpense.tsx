import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildPdf, buildFileName } from '../lib/pdfBuilder'
import CameraView    from '../components/scanner/CameraView'
import CropView      from '../components/scanner/CropView'
import ReviewCard, { type ReviewMeta } from '../components/scanner/ReviewCard'
import SuccessScreen from '../components/scanner/SuccessScreen'
import { useAuth }   from '../context/AuthContext'
import type { Database, ExpenseType } from '../lib/database.types'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

type Step = 'vehicle-select' | 'camera' | 'crop' | 'meta' | 'review' | 'success'

interface MetaFields {
  betrag:  string
  projekt: string
  datum:   string
}

const today = () => {
  const d = new Date()
  return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('.')
}

export const AddExpense: React.FC = () => {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const { user }        = useAuth()

  const [step,             setStep]            = useState<Step>('vehicle-select')
  const [vehicles,         setVehicles]        = useState<Vehicle[]>([])
  const [selectedVehicle,  setSelectedVehicle] = useState<Vehicle | null>(null)
  const [expenseType,      setExpenseType]     = useState<ExpenseType>('fuel')
  const [imageData,        setImageData]       = useState<string | null>(null)
  const [meta,             setMeta]            = useState<ReviewMeta | null>(null)
  const [uploading,        setUploading]       = useState(false)
  const [uploadError,      setUploadError]     = useState<string | null>(null)
  const [lastFilename,     setLastFilename]    = useState('')
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)

  const [betrag,  setBetrag]  = useState('')
  const [projekt, setProjekt] = useState('')
  const [datum,   setDatum]   = useState(today)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('vehicles').select('*').order('model').then(({ data }) => {
      if (data) {
        setVehicles(data)
        const preselect = searchParams.get('vehicle')
        if (preselect) {
          const found = data.find(v => v.id === preselect)
          if (found) setSelectedVehicle(found)
        }
      }
      setIsLoadingVehicles(false)
    })
  }, [searchParams])

  const handleVehicleSubmit = () => {
    setStep('camera')
  }

  const handleImageCaptured = useCallback((dataUrl: string) => {
    setImageData(dataUrl)
    setStep('crop')
  }, [])

  const handleCropDone = useCallback((croppedDataUrl: string) => {
    setImageData(croppedDataUrl)
    setStep('meta')
  }, [])

  function validateMeta(): boolean {
    const e: Record<string, string> = {}
    if (!betrag.trim()) {
      e.betrag = 'Betrag ist erforderlich.'
    } else if (!/^\d+([.,]\d{1,2})?$/.test(betrag.trim())) {
      e.betrag = 'Format: 42,50 oder 42.50'
    }
    if (!projekt.trim()) e.projekt = 'Projekt ist erforderlich.'
    if (!datum.trim()) {
      e.datum = 'Datum ist erforderlich.'
    } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(datum.trim())) {
      e.datum = 'Format: TT.MM.JJJJ'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleMetaSubmit = () => {
    if (!validateMeta()) return
    const metaFields: MetaFields = { betrag: betrag.trim(), projekt: projekt.trim(), datum: datum.trim() }
    const zusatz = selectedVehicle?.license_plate ?? ''
    const fileName = buildFileName({ ...metaFields, ...(zusatz ? { zusatz } : {}) })
    setMeta({
      ...metaFields,
      zusatz,
      expenseType,
      vehicleId:    selectedVehicle?.id ?? null,
      vehicleModel: selectedVehicle?.model ?? '',
      fileName,
    })
    setStep('review')
  }

  const handleSave = useCallback(async (finalFilename: string, finalImageUrl: string) => {
    if (!meta || !user) return
    setUploading(true)
    setUploadError(null)

    const [dd, mm, yyyy] = meta.datum.split('.')
    const isoDate  = `${yyyy}-${mm}-${dd}`
    const amountNum = parseFloat(meta.betrag.replace(',', '.'))

    try {
      const pdfBlob = await buildPdf(finalImageUrl, {
        betrag:  meta.betrag,
        projekt: meta.projekt,
        datum:   meta.datum,
        zusatz:  meta.zusatz || undefined,
      })

      // PDF in Supabase Storage hochladen
      let pdfUrl: string | null = null
      const safeFilename = finalFilename
        .replace(/[^a-zA-Z0-9._\-]/g, '_')
        .replace(/__+/g, '_')
      const storagePath = `${user.id}/${safeFilename}`
      const { error: storageError } = await supabase.storage
        .from('expense-pdfs')
        .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (storageError) {
        console.error('Storage-Fehler:', storageError.message)
        throw new Error(`Storage-Fehler: ${storageError.message}`)
      }
      const { data: { publicUrl } } = supabase.storage
        .from('expense-pdfs')
        .getPublicUrl(storagePath)
      pdfUrl = publicUrl

      // Supabase speichern
      const { error: dbError } = await supabase.from('expenses').insert({
        vehicle_id:   meta.vehicleId ?? undefined,
        driver_id:    user.id,
        amount:       amountNum,
        type:         meta.expenseType,
        date:         isoDate,
        dropbox_link: pdfUrl,
      })
      if (dbError) throw new Error(`DB-Fehler: ${dbError.message}`)

      // PDF teilen via Web Share API
      const pdfFile = new File([pdfBlob], finalFilename, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [pdfFile] })) {
        try {
          await navigator.share({ files: [pdfFile], title: finalFilename })
        } catch {
          // Nutzer hat Teilen abgebrochen — kein Fehler
        }
      } else {
        // Fallback: direkter Download
        const url = URL.createObjectURL(pdfBlob)
        const a   = document.createElement('a')
        a.href    = url
        a.download = finalFilename
        a.click()
        URL.revokeObjectURL(url)
      }

      setLastFilename(finalFilename)
      setStep('success')
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }, [meta, user])

  const reset = useCallback(() => {
    setStep('vehicle-select')
    setImageData(null)
    setMeta(null)
    setBetrag('')
    setProjekt('')
    setDatum(today)
    setErrors({})
    setUploadError(null)
    setLastFilename('')
  }, [])

  if (step === 'camera') {
    return (
      <div className="absolute inset-0 z-50">
        <CameraView onCapture={handleImageCaptured} onBack={() => setStep('vehicle-select')} />
      </div>
    )
  }
  if (step === 'crop' && imageData) {
    return (
      <div className="absolute inset-0 z-50">
        <CropView imageDataUrl={imageData} onCrop={handleCropDone} onBack={() => setStep('camera')} />
      </div>
    )
  }
  if (step === 'review' && meta && imageData) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50 safe-top">
        <ReviewCard
          imageDataUrl={imageData}
          meta={meta}
          onConfirm={handleSave}
          onBack={() => setStep('meta')}
          uploading={uploading}
          uploadError={uploadError}
        />
      </div>
    )
  }
  if (step === 'success') {
    return (
      <div className="flex flex-col h-dvh bg-gray-50 safe-top">
        <SuccessScreen fileName={lastFilename} onScanNew={reset} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50 safe-top">

      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate('/dashboard')}
          className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="font-bold text-gray-900">
          {step === 'vehicle-select' ? 'Ausgabe erfassen' : 'Beleg-Details'}
        </span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {step === 'vehicle-select' && (
          <>
            {isLoadingVehicles ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fahrzeug</label>
                  <div className="space-y-2">
                    {vehicles.map(v => (
                      <button key={v.id} onClick={() => setSelectedVehicle(v)}
                        className={['w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-colors text-left',
                          selectedVehicle?.id === v.id
                            ? 'bg-brand-50 border-brand-700'
                            : 'bg-white border-gray-200'].join(' ')}>
                        <span className="text-2xl">🚗</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{v.model}</p>
                          <p className="text-sm font-mono text-gray-500">{v.license_plate}</p>
                        </div>
                        {selectedVehicle?.id === v.id && (
                          <span className="text-brand-700 text-xl">✓</span>
                        )}
                      </button>
                    ))}
                    {vehicles.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 text-sm text-amber-800">
                        Noch keine Fahrzeuge angelegt. Bitte zuerst ein Fahrzeug hinzufügen.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ausgaben-Typ</label>
                  <div className="flex gap-3">
                    {(['fuel', 'charge'] as ExpenseType[]).map(t => (
                      <button key={t} onClick={() => setExpenseType(t)}
                        className={['flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-bold transition-colors',
                          expenseType === t ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700'].join(' ')}>
                        <span className="text-xl">{t === 'fuel' ? '⛽' : '⚡'}</span>
                        {t === 'fuel' ? 'Tanken' : 'Laden'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleVehicleSubmit}
                  className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-3">
                  <span className="text-xl">📷</span>
                  Beleg fotografieren
                </button>
                {!selectedVehicle && vehicles.length > 0 && (
                  <p className="text-center text-xs text-gray-400">
                    Kein Fahrzeug ausgewählt — du kannst trotzdem fortfahren.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {step === 'meta' && imageData && (
          <>
            <div className="relative bg-black rounded-2xl overflow-hidden">
              <img src={imageData} alt="Beleg" className="w-full max-h-48 object-contain" />
              <button onClick={() => setStep('camera')}
                className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white text-lg flex items-center justify-center">
                ‹
              </button>
            </div>

            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{selectedVehicle ? '🚗' : '📋'}</span>
              <div>
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Fahrzeug</p>
                <p className="text-sm font-bold text-brand-900">
                  {selectedVehicle ? `${selectedVehicle.model} · ${selectedVehicle.license_plate}` : 'Kein Fahrzeug'}
                </p>
              </div>
              <span className="ml-auto text-sm font-semibold text-brand-700">
                {expenseType === 'fuel' ? '⛽ Tanken' : '⚡ Laden'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Betrag <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                <input
                  type="text" inputMode="decimal" placeholder="31,14" value={betrag}
                  onChange={e => { setBetrag(e.target.value); setErrors(p => ({ ...p, betrag: '' })) }}
                  className={['w-full pl-9 pr-4 py-3 rounded-xl border-2 bg-white text-gray-900 font-medium text-lg outline-none transition-colors',
                    errors.betrag ? 'border-red-400' : 'border-gray-200 focus:border-brand-500'].join(' ')}
                />
              </div>
              {errors.betrag && <p className="text-red-500 text-xs mt-1">{errors.betrag}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Projekt / Kunde <span className="text-red-500">*</span>
              </label>
              <input
                type="text" placeholder="z. B. Audi, Privatfahrt…" value={projekt}
                onChange={e => { setProjekt(e.target.value); setErrors(p => ({ ...p, projekt: '' })) }}
                className={['w-full px-4 py-3 rounded-xl border-2 bg-white text-gray-900 font-medium outline-none transition-colors',
                  errors.projekt ? 'border-red-400' : 'border-gray-200 focus:border-brand-500'].join(' ')}
              />
              {errors.projekt && <p className="text-red-500 text-xs mt-1">{errors.projekt}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Datum <span className="text-red-500">*</span>
              </label>
              <input
                type="text" inputMode="numeric" placeholder="TT.MM.JJJJ" value={datum}
                onChange={e => { setDatum(e.target.value); setErrors(p => ({ ...p, datum: '' })) }}
                className={['w-full px-4 py-3 rounded-xl border-2 bg-white text-gray-900 font-medium outline-none transition-colors',
                  errors.datum ? 'border-red-400' : 'border-gray-200 focus:border-brand-500'].join(' ')}
              />
              {errors.datum && <p className="text-red-500 text-xs mt-1">{errors.datum}</p>}
            </div>

            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
              <p className="text-xs text-brand-700 font-semibold uppercase tracking-wide mb-1">Dateiname</p>
              <p className="text-sm text-brand-900 font-mono break-all">
                {betrag && datum
                  ? buildFileName({ betrag: betrag.trim(), projekt: projekt.trim() || '…', datum: datum.trim(), ...(selectedVehicle ? { zusatz: selectedVehicle.license_plate } : {}) })
                  : '—'}
              </p>
            </div>

            <button onClick={handleMetaSubmit}
              className="w-full py-4 bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-transform">
              Weiter zur Überprüfung →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
