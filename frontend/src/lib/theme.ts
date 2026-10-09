import type { Theme } from './types'

// The key is also read by the inline script in index.html, which sets the theme before
// the first paint. Keep the two in step.
export const THEME_STORAGE_KEY = 'es-theme'

const THEME_COLOR: Record<Theme, string> = { dark: '#10131c', light: '#eef0f4' }

/** Anything other than "light" means dark, the default. */
export function parseTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark'
}

export function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

/** The theme currently on the page (set before first paint by index.html). */
export function pageTheme(): Theme {
  return parseTheme(document.documentElement.dataset.theme)
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
}
