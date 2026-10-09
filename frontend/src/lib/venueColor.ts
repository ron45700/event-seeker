import type { CSSProperties } from 'react'

/**
 * Hand-picked hues for known venues (OKLCH hue angle, 0 to 360). Any venue not listed
 * gets a hue derived from its name, so new venues need no code change.
 */
export const VENUE_HUE_OVERRIDES: Record<string, number> = {
  'בארבי': 352, // rose red
  'רידינג 3': 205, // harbour blue
}

// The Sodium highlight (#F4B740) sits near hue 80. Hashed hues skip this band so a venue
// badge is never mistaken for the "following" highlight.
const RESERVED_START = 35
const RESERVED_END = 125
const AVAILABLE = 360 - (RESERVED_END - RESERVED_START)

/** FNV-1a, 32 bit. Stable across sessions and browsers. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function venueHue(venue: string): number {
  const name = venue.trim()
  const override = VENUE_HUE_OVERRIDES[name]
  if (override !== undefined) return override
  return (RESERVED_END + (hash(name) % AVAILABLE)) % 360
}

/** CSS custom properties for a venue: badge fill, ink on the badge, and a deep tint. */
export function venueStyle(venue: string): CSSProperties {
  const hue = venueHue(venue)
  return {
    '--venue': `oklch(0.76 0.13 ${hue})`,
    '--venue-ink': `oklch(0.22 0.05 ${hue})`,
    '--venue-deep': `oklch(0.30 0.07 ${hue})`,
    '--venue-glow': `oklch(0.86 0.09 ${hue})`,
  } as CSSProperties
}
