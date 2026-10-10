import { offSale } from './availability'
import { dateFilterLabel, dateRange, inRange, israelToday } from './dates'
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

/**
 * Whether term appears in text as whole words, like contains_term() in app/matching.py
 * (the Hebrew conjunction prefix vav is allowed). Used where the result must agree with
 * the alerts, e.g. the venues of a subscription.
 */
export function containsTerm(text: string, term: string): boolean {
  const needle = normalize(term)
  if (!needle) return false
  const haystack = ` ${normalize(text)} `
  return haystack.includes(` ${needle} `) || haystack.includes(` ו${needle} `)
}

/** Whether an event is at one of the venues, as a subscription's venue matches; none = any. */
export function atVenues(event: ShowEvent, venues: string[]): boolean {
  return venues.length === 0 || venues.some((venue) => containsTerm(`${event.venue} ${event.city}`, venue))
}

/**
 * The events page filters, kept in the URL (see router.ts). The category is in the URL
 * too and is passed alongside.
 */
export interface ShowFilters {
  query: string
  /** Exact venue names; empty for all venues. */
  venues: string[]
  /** A date filter value (see dates.ts); '' for any date. */
  date: string
  mine: boolean
  /** Hide sold-out and unavailable events. */
  hideOffSale: boolean
}

export const NO_FILTERS: ShowFilters = { query: '', venues: [], date: '', mine: false, hideOffSale: false }

export function sameFilters(a: ShowFilters, b: ShowFilters): boolean {
  return (
    a.query === b.query &&
    a.date === b.date &&
    a.mine === b.mine &&
    a.hideOffSale === b.hideOffSale &&
    a.venues.length === b.venues.length &&
    a.venues.every((venue, i) => venue === b.venues[i])
  )
}

/** The same filters with the panel's filters cleared; the search stays. */
export function withoutPanelFilters(filters: ShowFilters): ShowFilters {
  return { ...NO_FILTERS, query: filters.query }
}

/** Events in a category; null means all categories. */
export function inCategory(events: ShowEvent[], category: string | null): ShowEvent[] {
  return category ? events.filter((event) => event.category === category) : events
}

/** `today` is Israel's date, "YYYY-MM-DD"; it anchors presets such as "this weekend". */
export function applyFilters(
  events: ShowEvent[],
  filters: ShowFilters,
  category: string | null = null,
  today: string = israelToday(),
): ShowEvent[] {
  const venues = new Set(filters.venues)
  const range = dateRange(filters.date, today)
  return inCategory(events, category).filter(
    (event) =>
      (venues.size === 0 || venues.has(event.venue)) &&
      (!range || inRange(event, range)) &&
      (!filters.mine || event.subscribed) &&
      (!filters.hideOffSale || offSale(event) === null) &&
      matchesQuery(event, filters.query),
  )
}

export interface VenueChoice {
  venue: string
  /** Events at the venue; undefined where counts are not shown. */
  count?: number
}

/**
 * The venue picker's list: the venues that have events among `events` (already narrowed
 * to the category) with their counts, sorted by name. Selected venues stay listed even
 * without events, so they can be cleared.
 */
export function venueChoices(events: ShowEvent[], selected: string[]): VenueChoice[] {
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.venue, (counts.get(event.venue) ?? 0) + 1)
  for (const venue of selected) if (!counts.has(venue)) counts.set(venue, 0)
  return [...counts]
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => a.venue.localeCompare(b.venue, 'he'))
}

/** Filters set in the filter panel (search and category are always visible). */
export function activeFilterCount(filters: ShowFilters): number {
  return (
    (filters.venues.length > 0 ? 1 : 0) +
    (filters.date ? 1 : 0) +
    (filters.mine ? 1 : 0) +
    (filters.hideOffSale ? 1 : 0)
  )
}

/** One removable chip for an active filter; `without` is the filters once it is removed. */
export interface FilterChip {
  key: string
  text: string
  /** Set on a single-venue chip, which carries that venue's colour dot. */
  venue?: string
  without: ShowFilters
}

/** More venues than this collapse into one "N מקומות" chip. */
const VENUE_CHIPS_MAX = 2

/** The chips beside the filter button, in the panel's order: date, venues, toggles. */
export function filterChips(filters: ShowFilters, today: string): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.date) {
    chips.push({ key: 'date', text: dateFilterLabel(filters.date, today), without: { ...filters, date: '' } })
  }
  if (filters.venues.length > VENUE_CHIPS_MAX) {
    chips.push({ key: 'venues', text: `${filters.venues.length} מקומות`, without: { ...filters, venues: [] } })
  } else {
    for (const venue of filters.venues) {
      chips.push({
        key: `venue:${venue}`,
        text: venue,
        venue,
        without: { ...filters, venues: filters.venues.filter((v) => v !== venue) },
      })
    }
  }
  if (filters.mine) chips.push({ key: 'mine', text: 'רק האמנים שלי', without: { ...filters, mine: false } })
  if (filters.hideOffSale) {
    chips.push({ key: 'available', text: 'רק זמינים', without: { ...filters, hideOffSale: false } })
  }
  return chips
}
