import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, storeTheme, type Theme } from '../lib/theme'

interface ThemeContextValue {
  theme:    Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => { applyTheme(theme) }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    storeTheme(next)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
