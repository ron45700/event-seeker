// Shapes returned by the FastAPI backend (see app/api.py).

export type EventKind = 'show' | 'festival'

/** "available", "sold_out" or "unavailable"; null when the site exposes nothing. */
export type Availability = 'available' | 'sold_out' | 'unavailable'

export type Theme = 'dark' | 'light'

export interface ShowEvent {
  id: number
  source: string
  /** The shape of the event (one night or a festival), not its genre. */
  kind: EventKind
  /** The genre, e.g. "music" or "standup". Kept as a string: unknown values may arrive. */
  category: string
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
  availability: Availability | null
  /** Only where the site exposes counts (Barby). */
  tickets_left: number | null
  /** The event matches one of the signed-in user's subscriptions. */
  subscribed: boolean
}

export interface Me {
  email: string
  paused: boolean
  theme: Theme
  /** Offer the admin entry in the account menu. Cosmetic: the panel asks for its password. */
  show_admin: boolean
}

/** A registered user as the admin panel lists it. */
export interface AdminUser {
  id: number
  email: string
  /** UTC, ISO 8601 with a Z. */
  created_at: string
  paused: boolean
  subscriptions: Subscription[]
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
