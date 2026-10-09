import { describe, expect, it } from 'vitest'
import { ALL_EVENTS_LABEL, CATEGORY_LABELS, categoryFromParam, categorySegments, isKnownCategory } from './categories'
import { activeFilterCount, applyFilters, inCategory, matchesQuery, NO_FILTERS, normalize, venueChoices } from './search'
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

  it('combines venue, mine and query', () => {
    expect(ids(applyFilters(events, { ...NO_FILTERS, venue: 'A' }))).toEqual([1, 3])
    expect(ids(applyFilters(events, { ...NO_FILTERS, mine: true }))).toEqual([1])
    expect(ids(applyFilters(events, { ...NO_FILTERS, query: 'oth', venue: 'A' }))).toEqual([3])
  })

  it('narrows by category and keeps unknown categories under "all"', () => {
    expect(ids(inCategory(events, null))).toEqual([1, 2, 3, 4])
    expect(ids(applyFilters(events, NO_FILTERS, 'standup'))).toEqual([2])
    expect(ids(applyFilters(events, { ...NO_FILTERS, venue: 'A' }, 'music'))).toEqual([1, 3])
  })

  it('hides sold-out and unavailable events but keeps unknown availability', () => {
    expect(ids(applyFilters(events, { ...NO_FILTERS, hideOffSale: true }))).toEqual([1, 4])
  })

  it('counts the filters behind the phone filter button', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...NO_FILTERS, query: 'x' })).toBe(0)
    expect(activeFilterCount({ query: '', venue: 'A', mine: true, hideOffSale: true })).toBe(3)
  })
})

describe('venueChoices', () => {
  const events = [event({ venue: 'בארבי' }), event({ venue: 'זאפה הרצליה' }), event({ venue: 'בארבי' })]

  it('lists each venue with events once, sorted', () => {
    expect(venueChoices(events, '')).toEqual(['בארבי', 'זאפה הרצליה'])
  })

  it('keeps the selected venue even when the category has none there', () => {
    expect(venueChoices(inCategory(events, 'standup'), 'בארבי')).toEqual(['בארבי'])
  })
})
