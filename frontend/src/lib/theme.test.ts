import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseTheme, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from './theme'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseTheme', () => {
  it('defaults to dark for anything but "light"', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme(null)).toBe('dark')
    expect(parseTheme('sepia')).toBe('dark')
  })
})

describe('stored theme', () => {
  it('reads and writes the same key the inline script in index.html reads', () => {
    const localStorage = fakeStorage()
    vi.stubGlobal('window', { localStorage })
    expect(readStoredTheme()).toBe('dark')
    storeTheme('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(readStoredTheme()).toBe('light')
    expect(THEME_STORAGE_KEY).toBe('es-theme')
  })

  it('falls back to dark when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked')
      },
    })
    expect(readStoredTheme()).toBe('dark')
    expect(() => storeTheme('light')).not.toThrow()
  })
})
