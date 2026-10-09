// Shapes returned by the FastAPI backend (see app/api.py).

export type EventKind = 'show' | 'festival'

export interface ShowEvent {
  id: number
  source: string
  kind: EventKind
  title: string
  /** Guests for a show, the lineup for a festival. */
  artists: string[]
  /** Israel local time without a timezone, e.g. "2026-11-13T21:00:00". Displayed as is. */
  starts_at: string
  ends_at: string | null
  venue: string
  city: string
  url: string
  /** Shekels without a currency sign. */
  price: string | null
  image_url: string | null
  /** The show matches one of the signed-in user's subscriptions. */
  subscribed: boolean
}

export interface Me {
  email: string
  paused: boolean
}

export interface Subscription {
  id: number
  artist: string
  /** null means any venue. */
  venue: string | null
}

export interface Venue {
  venue: string
  city: string
}
