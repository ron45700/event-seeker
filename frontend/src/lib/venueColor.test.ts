import { describe, expect, it } from 'vitest'
import { VENUE_HUE_OVERRIDES, venueHue } from './venueColor'

// Sodium #F4B740 is about hue 80 in OKLCH.
const SODIUM_HUE = 80

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
    expect(hueDistance(barby, SODIUM_HUE)).toBeGreaterThanOrEqual(60)
    expect(hueDistance(reading, SODIUM_HUE)).toBeGreaterThanOrEqual(60)
  })

  it('gives an unknown venue a stable hue outside the highlight band', () => {
    for (const name of ['זאפה', 'הבית', 'Ozen', 'פסטיבל אינדינגב', 'the Zone', 'לבונטין 7']) {
      const hue = venueHue(name)
      expect(hue).toBe(venueHue(name))
      expect(hueDistance(hue, SODIUM_HUE)).toBeGreaterThanOrEqual(45)
    }
  })
})
