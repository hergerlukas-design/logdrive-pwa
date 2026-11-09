import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SheetProps {
  title:     string
  badge?:    React.ReactNode
  onClose:   () => void
  children:  React.ReactNode
}

/** Von unten einfahrendes Blatt für die Detailansichten der Kartei */
export function Sheet({ title, badge, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return createPortal(
    <>
      <div className="qc-sheet-backdrop" onClick={onClose} />
      <section className="qc-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="qc-sheet-grip" />
        <header className="qc-sheet-head">
          <h3>{title}</h3>
          {badge}
          <button type="button" onClick={onClose} aria-label="Schließen"
            className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 grid place-items-center active:scale-95">
            <X size={16} strokeWidth={2.5} />
          </button>
        </header>
        <div className="qc-sheet-body">{children}</div>
      </section>
    </>,
    document.body,
  )
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={'qc-field ' + className}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="qc-kv"><span>{label}</span><span>{value}</span></div>
}

export function SaveBar({ busy, error, onCancel, label = 'Speichern' }: {
  busy: boolean; error: string | null; onCancel?: () => void; label?: string
}) {
  return (
    <div className="pt-2 space-y-2">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-bold active:scale-95 transition-transform">
            Abbrechen
          </button>
        )}
        <button type="submit" disabled={busy}
          className="flex-1 py-3 rounded-2xl bg-brand-700 text-white font-bold shadow-md active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center">
          {busy ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : label}
        </button>
      </div>
    </div>
  )
}

export function EditButton({ onClick, label = 'Bearbeiten' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full mt-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold active:scale-95 transition-transform">
      {label}
    </button>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 text-center py-6">{children}</p>
}
