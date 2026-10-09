import type { ShowEvent } from './types'

/**
 * The one place a card image URL is built. Cards use the backend thumbnail (a small cached
 * WebP) instead of the venue's full-size image. If the backend cannot build a thumbnail it
 * redirects to the original image.
 */
export function cardImageSrc(event: ShowEvent): string | null {
  return event.image_url ? `/api/events/${event.id}/thumbnail` : null
}
