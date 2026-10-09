import { describe, expect, it } from 'vitest'
import { VENUE_HUE_OVERRIDES, venueHue, venueProps } from './venueColor'

// Accent #F4B740 is about hue 80 in OKLCH.
const ACCENT_HUE = 80

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

describe('venueHue', () => {
  it('uses the override for known venues', () => {
    expect(venueHue('בארבי')).toBe(VENUE_HUE_OVERRIDES['בארבי'])
    expect(venueHue(' רידינג 3 ')).toBe(VENUE_HUE_OVERRIDES['רידינג 3'])
  })

  it('keeps the known venues apart from each other and from the highlight', () => {
    const barby = venueHue('בארבי')
    const reading = venueHue('רידינג 3')
    expect(hueDistance(barby, reading)).toBeGreaterThanOrEqual(90)
    expect(hueDistance(barby, ACCENT_HUE)).toBeGreaterThanOrEqual(60)
    expect(hueDistance(reading, ACCENT_HUE)).toBeGreaterThanOrEqual(60)
  })

  it('keeps every overridden venue at least 45 degrees from the others and the highlight', () => {
    const hues = Object.values(VENUE_HUE_OVERRIDES)
    for (const [i, hue] of hues.entries()) {
      expect(hueDistance(hue, ACCENT_HUE)).toBeGreaterThanOrEqual(45)
      for (const other of hues.slice(i + 1)) expect(hueDistance(hue, other)).toBeGreaterThanOrEqual(45)
    }
  })

  it('gives an unknown venue a stable hue outside the highlight band', () => {
    for (const name of ['Ozen', 'the Zone', 'לבונטין 7', 'הבית', 'פסטיבל אינדינגב']) {
      const hue = venueHue(name)
      expect(hue).toBe(venueHue(name))
      expect(hueDistance(hue, ACCENT_HUE)).toBeGreaterThanOrEqual(45)
    }
  })
})

describe('venueProps', () => {
  it('passes only the hue, marked for the theme formulas in tokens.css', () => {
    const props = venueProps('בארבי')
    expect(props['data-venue']).toBe('')
    expect(props.style).toEqual({ '--venue-hue': VENUE_HUE_OVERRIDES['בארבי'] })
  })
})
