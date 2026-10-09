import { offSale } from './availability'
import type { ShowEvent } from './types'

// Mirrors normalize() in app/matching.py: lowercase, strip niqqud and accents,
// punctuation to spaces. The search box matches substrings so results appear while
// typing; the server's whole-word matching is kept for alerts.
const COMBINING = /\p{M}/gu
const PUNCTUATION = /[^\p{L}\p{N}\s]|_/gu
const SPACES = /\s+/g

export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(SPACES, ' ')
    .trim()
}

/** Every word of the query appears somewhere in the title or the guest / lineup names. */
export function matchesQuery(event: ShowEvent, query: string): boolean {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalize([event.title, ...event.artists].join(' | '))
  return terms.every((term) => haystack.includes(term))
}

/** The filters kept in screen state. The category lives in the URL and is passed alongside. */
export interface ShowFilters {
  query: string
  /** Exact venue name, or '' for all venues. */
  venue: string
  mine: boolean
  /** Hide sold-out and unavailable events. */
  hideOffSale: boolean
}

export const NO_FILTERS: ShowFilters = { query: '', venue: '', mine: false, hideOffSale: false }

/** Events in a category; null means all categories. */
export function inCategory(events: ShowEvent[], category: string | null): ShowEvent[] {
  return category ? events.filter((event) => event.category === category) : events
}

export function applyFilters(
  events: ShowEvent[],
  filters: ShowFilters,
  category: string | null = null,
): ShowEvent[] {
  return inCategory(events, category).filter(
    (event) =>
      (!filters.venue || event.venue === filters.venue) &&
      (!filters.mine || event.subscribed) &&
      (!filters.hideOffSale || offSale(event) === null) &&
      matchesQuery(event, filters.query),
  )
}

/**
 * Venue chips: the venues that have events among `events` (already narrowed to the
 * category), sorted. The selected venue stays listed even without events, so it can be
 * cleared.
 */
export function venueChoices(events: ShowEvent[], selected: string): string[] {
  const venues = new Set(events.map((event) => event.venue))
  if (selected) venues.add(selected)
  return [...venues].sort((a, b) => a.localeCompare(b, 'he'))
}

/** Filters behind the phone's filter button (search and category are always visible). */
export function activeFilterCount(filters: ShowFilters): number {
  return (filters.venue ? 1 : 0) + (filters.mine ? 1 : 0) + (filters.hideOffSale ? 1 : 0)
}
