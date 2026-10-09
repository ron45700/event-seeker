import type { CSSProperties } from 'react'

/**
 * Hand-picked hues for known venues (OKLCH hue angle, 0 to 360). Any venue not listed
 * gets a hue derived from its name, so new venues need no code change.
 */
export const VENUE_HUE_OVERRIDES: Record<string, number> = {
  // Spread about 50 degrees apart: hashing alone put the three Zappa venues in the same
  // blues as Reading 3.
  'זאפה אמפי שוני': 140, // green
  'רידינג 3': 205, // harbour blue
  'זאפה הרצליה': 255, // indigo
  'זאפה תל אביב': 305, // magenta
  'בארבי': 352, // rose red
}

// The amber highlight (#F4B740) sits near hue 80. Hashed hues skip this band so a venue
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

/**
 * Props that colour an element by its venue. The hue is all that varies per venue;
 * tokens.css turns it into fill, ink and tints for the current theme.
 */
export function venueProps(venue: string): { style: CSSProperties; 'data-venue': '' } {
  return { style: { '--venue-hue': venueHue(venue) } as CSSProperties, 'data-venue': '' }
}
