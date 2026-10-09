import type { ShowEvent } from './types'

/** Short stable hash of a string (FNV-1a), used only to version a URL. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * The one place a card image URL is built. Cards use the backend thumbnail (a small cached
 * WebP) instead of the venue's full-size image. If the backend cannot build a thumbnail it
 * redirects to the original image.
 *
 * The `v` parameter changes whenever the source image changes. The browser caches thumbnails
 * for a day, so without it a replaced image would keep showing the old one.
 */
export function cardImageSrc(event: ShowEvent): string | null {
  return event.image_url ? `/api/events/${event.id}/thumbnail?v=${hash(event.image_url)}` : null
}
