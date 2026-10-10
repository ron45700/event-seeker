import { describe, expect, it } from 'vitest'
import { ALL_EVENTS_LABEL, CATEGORY_LABELS, categoryFromParam, categorySegments, isKnownCategory } from './categories'
import {
  activeFilterCount,
  applyFilters,
  atVenues,
  containsTerm,
  filterChips,
  inCategory,
  matchesQuery,
  NO_FILTERS,
  normalize,
  venueChoices,
} from './search'
import type { ShowEvent } from './types'

function event(overrides: Partial<ShowEvent>): ShowEvent {
  return {
    id: 1,
    source: 'test',
    kind: 'show',
    category: 'music',
    title: 'Example',
    artists: [],
    starts_at: '2026-10-10T21:00:00',
    ends_at: null,
    venue: 'Venue A',
    city: 'City',
    url: 'https://example.com',
    price: null,
    image_url: null,
    availability: null,
    tickets_left: null,
    subscribed: false,
    ...overrides,
  }
}

describe('normalize', () => {
  it('strips niqqud, case and punctuation like the backend', () => {
    expect(normalize('שָׁלוֹם')).toBe('שלום')
    expect(normalize('QUEENS - מיכאל')).toBe('queens מיכאל')
    expect(normalize('Beyoncé!')).toBe('beyonce')
  })
})

describe('matchesQuery', () => {
  const show = event({ title: 'אביתר בנאי והלהקה', artists: ['Guest Star'] })

  it('matches a partial word while typing', () => {
    expect(matchesQuery(show, 'אבית')).toBe(true)
  })

  it('needs every word to appear', () => {
    expect(matchesQuery(show, 'בנאי אביתר')).toBe(true)
    expect(matchesQuery(show, 'אביתר שלום')).toBe(false)
  })

  it('searches guests and ignores case', () => {
    expect(matchesQuery(show, 'guest')).toBe(true)
  })

  it('treats an empty query as a match', () => {
    expect(matchesQuery(show, '  ')).toBe(true)
  })
})

describe('categories', () => {
  it('knows only the categories in the label map', () => {
    expect(Object.keys(CATEGORY_LABELS)).toEqual(['music', 'standup'])
    expect(isKnownCategory('standup')).toBe(true)
    expect(isKnownCategory('theatre')).toBe(false)
    expect(isKnownCategory('toString')).toBe(false)
  })

  it('builds the segmented control with "all events" first and selected for no category', () => {
    expect(categorySegments()).toEqual([
      { category: null, label: ALL_EVENTS_LABEL },
      { category: 'music', label: 'הופעות' },
      { category: 'standup', label: 'סטנד אפ' },
    ])
    expect(ALL_EVENTS_LABEL).toBe('כל האירועים')
  })

  it('ignores an unknown or missing category parameter', () => {
    expect(categoryFromParam('music')).toBe('music')
    expect(categoryFromParam('theatre')).toBeNull()
    expect(categoryFromParam(null)).toBeNull()
  })
})

describe('applyFilters', () => {
  const events = [
    event({ id: 1, venue: 'A', subscribed: true, availability: 'available' }),
    event({ id: 2, venue: 'B', category: 'standup', availability: 'sold_out' }),
    event({ id: 3, venue: 'A', title: 'Other', availability: 'unavailable' }),
    event({ id: 4, venue: 'C', category: 'theatre' }),
  ]
  const ids = (list: ShowEvent[]) => list.map((e) => e.id)

  it('combines venues, mine and query', () => {
    expect(ids(applyFilters(events, { ...NO_FILTERS, venues: ['A'] }))).toEqual([1, 3])
    expect(ids(applyFilters(events, { ...NO_FILTERS, venues: ['A', 'B'] }))).toEqual([1, 2, 3])
    expect(ids(applyFilters(events, { ...NO_FILTERS, mine: true }))).toEqual([1])
    expect(ids(applyFilters(events, { ...NO_FILTERS, query: 'oth', venues: ['A'] }))).toEqual([3])
  })

  it('filters by date in Israel time, counting a festival on each of its days', () => {
    const dated = [
      event({ id: 1, starts_at: '2026-10-15T21:00:00' }), // Thursday
      event({ id: 2, starts_at: '2026-10-17T22:30:00' }), // Saturday
      event({ id: 3, starts_at: '2026-11-02T20:00:00' }),
      event({ id: 4, starts_at: '2026-10-08T18:00:00', ends_at: '2026-10-16T23:00:00' }),
    ]
    const today = '2026-10-12' // Monday
    const by = (date: string) => ids(applyFilters(dated, { ...NO_FILTERS, date }, null, today))
    expect(by('weekend')).toEqual([1, 2, 4])
    expect(by('2026-11')).toEqual([3])
    expect(by('2026-10-17')).toEqual([2])
    expect(by('2026-10-16..2026-11-30')).toEqual([2, 3, 4])
    expect(by('nonsense')).toEqual([1, 2, 3, 4])
  })

  it('narrows by category and keeps unknown categories under "all"', () => {
    expect(ids(inCategory(events, null))).toEqual([1, 2, 3, 4])
    expect(ids(applyFilters(events, NO_FILTERS, 'standup'))).toEqual([2])
    expect(ids(applyFilters(events, { ...NO_FILTERS, venues: ['A'] }, 'music'))).toEqual([1, 3])
  })

  it('hides sold-out and unavailable events but keeps unknown availability', () => {
    expect(ids(applyFilters(events, { ...NO_FILTERS, hideOffSale: true }))).toEqual([1, 4])
  })

  it('counts the filters behind the filter button, a venue list as one', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...NO_FILTERS, query: 'x' })).toBe(0)
    expect(activeFilterCount({ query: '', venues: ['A', 'B'], date: 'today', mine: true, hideOffSale: true })).toBe(4)
  })
})

describe('venueChoices', () => {
  const events = [event({ venue: 'בארבי' }), event({ venue: 'זאפה הרצליה' }), event({ venue: 'בארבי' })]

  it('lists each venue with events once, sorted, with its count', () => {
    expect(venueChoices(events, [])).toEqual([
      { venue: 'בארבי', count: 2 },
      { venue: 'זאפה הרצליה', count: 1 },
    ])
  })

  it('keeps selected venues even when the category has none there', () => {
    expect(venueChoices(inCategory(events, 'standup'), ['בארבי'])).toEqual([{ venue: 'בארבי', count: 0 }])
  })
})

describe('containsTerm', () => {
  // Mirrors contains_term() in app/matching.py.
  it('matches whole words only, with the vav prefix', () => {
    expect(containsTerm('אביתר בנאי והלהקה', 'אביתר בנאי')).toBe(true)
    expect(containsTerm('אפרטונה בהופעה', 'טונה')).toBe(false)
    expect(containsTerm('חיים רומנו ושמוליק בודגוב', 'שמוליק בודגוב')).toBe(true)
    expect(containsTerm('אודיטוריום ספיר - כפר סבא', 'אודיטוריום ספיר-כפר סבא')).toBe(true)
    expect(containsTerm('anything', '  ')).toBe(false)
  })

  it('matches venues the way a subscription does', () => {
    const show = event({ venue: 'זאפה תל אביב', city: 'תל אביב' })
    expect(atVenues(show, [])).toBe(true)
    expect(atVenues(show, ['בארבי', 'זאפה תל אביב'])).toBe(true)
    expect(atVenues(show, ['זאפה הרצליה'])).toBe(false)
  })
})

describe('filterChips', () => {
  const today = '2026-10-12'

  it('has one chip per active filter, each removing only itself', () => {
    const filters = { ...NO_FILTERS, date: 'weekend', venues: ['A', 'B'], mine: true }
    const chips = filterChips(filters, today)
    expect(chips.map((c) => c.text)).toEqual(['סוף השבוע', 'A', 'B', 'רק האמנים שלי'])
    expect(chips[1].venue).toBe('A')
    expect(chips[1].without.venues).toEqual(['B'])
    expect(chips[0].without).toEqual({ ...filters, date: '' })
  })

  it('folds more than two venues into one chip', () => {
    const chips = filterChips({ ...NO_FILTERS, venues: ['A', 'B', 'C'] }, today)
    expect(chips.map((c) => c.text)).toEqual(['3 מקומות'])
    expect(chips[0].without.venues).toEqual([])
  })

  it('is empty with no filters, whatever the search', () => {
    expect(filterChips({ ...NO_FILTERS, query: 'x' }, today)).toEqual([])
  })
})
