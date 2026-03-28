import React from 'react'

// ── Button ────────────────────────────────────────────────────────────────────
interface ButtonProps {
  children:   React.ReactNode
  variant?:   'primary' | 'secondary' | 'danger' | 'ghost'
  full?:      boolean
  disabled?:  boolean
  loading?:   boolean
  onClick?:   () => void
  type?:      'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  children, variant = 'primary', full = false, disabled = false,
  loading = false, onClick, type = 'button', className = '',
}: ButtonProps) {
  const base = 'flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'
  const variants = {
    primary:   'bg-brand-700 text-white rounded-2xl shadow-md',
    secondary: 'bg-white border-2 border-gray-200 text-gray-600 rounded-2xl',
    danger:    'border-2 border-red-200 text-red-600 rounded-xl',
    ghost:     'text-brand-700 rounded-xl',
  }
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={[base, variants[variant], 'w-full py-4 text-lg', full ? 'w-full' : '', className].join(' ')}
    >
      {loading
        ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:    string
  hint?:     string
  error?:    string
}

export function Input({ label, hint, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>}
      <input
        id={id}
        className={[
          'w-full px-4 py-3 rounded-xl border-2 bg-white text-gray-900 font-medium outline-none transition-colors',
          error ? 'border-red-400' : 'border-gray-200 focus:border-brand-500',
          className,
        ].join(' ')}
        {...props}
      />
      {error  ? <p className="text-xs text-red-600">{error}</p>
       : hint ? <p className="text-xs text-gray-400">{hint}</p>
       : null}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
interface CardProps {
  children:   React.ReactNode
  className?: string
  onClick?:   () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={['bg-white rounded-2xl border border-gray-200 overflow-hidden',
        onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : '', className].join(' ')}
    >
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error'

const BADGE: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-500',
  primary: 'bg-brand-100 text-brand-800',
  success: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-600',
  error:   'bg-red-50 text-red-600',
}

export function Badge({ label, variant = 'default', className = '' }:
  { label: string; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={['text-xs font-semibold px-2 py-1 rounded-full', BADGE[variant], className].join(' ')}>
      {label}
    </span>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────
type AlertVariant = 'success' | 'error' | 'warning' | 'info'

const ALERT: Record<AlertVariant, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info:    'bg-brand-50 border-brand-200 text-brand-800',
}

export function Alert({ variant = 'info', children, className = '' }:
  { variant?: AlertVariant; children: React.ReactNode; className?: string }) {
  return (
    <div className={['flex items-start gap-3 border rounded-xl px-4 py-3 text-sm', ALERT[variant], className].join(' ')}>
      {children}
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }:
  { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-5 text-center">
      {icon && <div className="text-gray-300 mb-1">{icon}</div>}
      <p className="font-bold text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
