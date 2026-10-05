export type Theme = 'light' | 'retro'

const STORAGE_KEY = 'logdrive-theme'
const THEME_COLORS: Record<Theme, string> = { light: '#bc0120', retro: '#0b0b0c' }

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'retro' ? 'retro' : 'light'
  } catch {
    return 'light'
  }
}

export function storeTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* privater Modus */ }
}

/** Setzt die Theme-Klasse auf <html> und passt die Statusleisten-Farbe an. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('theme-retro', theme === 'retro')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}
