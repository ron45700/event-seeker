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

export interface ShowFilters {
  query: string
  /** Exact venue name, or '' for all venues. */
  venue: string
  mine: boolean
}

export const NO_FILTERS: ShowFilters = { query: '', venue: '', mine: false }

export function applyFilters(events: ShowEvent[], filters: ShowFilters): ShowEvent[] {
  return events.filter(
    (event) =>
      (!filters.venue || event.venue === filters.venue) &&
      (!filters.mine || event.subscribed) &&
      matchesQuery(event, filters.query),
  )
}

/** Filters behind the phone's filter button (search is always visible). */
export function activeFilterCount(filters: ShowFilters): number {
  return (filters.venue ? 1 : 0) + (filters.mine ? 1 : 0)
}
