import { useId } from 'react'

/** Synthwave-Header mit CarHandling-Logo – nur im Retro-Design sichtbar. */
export function RetroHeader() {
  const id = useId()
  const grey = `${id}-grey`
  const red  = `${id}-red`

  return (
    <header className="retro-header">
      <h1 className="retro-header__title">LOGDRIVE</h1>
      <p className="retro-header__subtitle">FAHRTENBUCH</p>
      <svg className="retro-header__logo" viewBox="0 0 200 200" role="img" aria-label="CarHandling Logo">
        <defs>
          <pattern id={grey} width="200" height="11" patternUnits="userSpaceOnUse">
            <rect width="200" height="7" fill="#c2c2c2" />
            <rect y="7" width="200" height="2" fill="#a9b0b8" />
          </pattern>
          <pattern id={red} width="200" height="11" patternUnits="userSpaceOnUse">
            <rect width="200" height="6" fill="#e8747e" />
            <rect y="6" width="200" height="3" fill="#bc0120" />
          </pattern>
        </defs>
        <path d="M156.6 43.4 A80 80 0 1 0 156.6 156.6" fill="none" stroke={`url(#${grey})`} strokeWidth="24" strokeLinecap="round" />
        <path d="M98.2 57.4 A52 52 0 0 0 98.2 142.6"   fill="none" stroke={`url(#${red})`}  strokeWidth="20" strokeLinecap="round" />
        <path d="M157.8 57.4 A52 52 0 0 1 157.8 142.6" fill="none" stroke={`url(#${red})`}  strokeWidth="20" strokeLinecap="round" />
        <path d="M78 100 H178"                          fill="none" stroke={`url(#${red})`}  strokeWidth="18" />
      </svg>
      <div className="retro-header__grid" aria-hidden="true" />
    </header>
  )
}
