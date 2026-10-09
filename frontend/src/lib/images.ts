import type { ShowEvent } from './types'

/**
 * The one place a card image URL is built. When the backend gains a thumbnail endpoint,
 * change this line, e.g. to `/api/events/${event.id}/thumbnail`.
 */
export function cardImageSrc(event: ShowEvent): string | null {
  return event.image_url
}
