import { describe, expect, it } from 'vitest'
import { applyFilters, matchesQuery, normalize } from './search'
import type { ShowEvent } from './types'

function show(overrides: Partial<ShowEvent>): ShowEvent {
  return {
    id: 1,
    source: 'test',
    kind: 'show',
    title: 'Example',
    artists: [],
    starts_at: '2026-10-10T21:00:00',
    ends_at: null,
    venue: 'Venue A',
    city: 'City',
    url: 'https://example.com',
    price: null,
    image_url: null,
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
  const event = show({ title: 'אביתר בנאי והלהקה', artists: ['Guest Star'] })

  it('matches a partial word while typing', () => {
    expect(matchesQuery(event, 'אבית')).toBe(true)
  })

  it('needs every word to appear', () => {
    expect(matchesQuery(event, 'בנאי אביתר')).toBe(true)
    expect(matchesQuery(event, 'אביתר שלום')).toBe(false)
  })

  it('searches guests and ignores case', () => {
    expect(matchesQuery(event, 'guest')).toBe(true)
  })

  it('treats an empty query as a match', () => {
    expect(matchesQuery(event, '  ')).toBe(true)
  })
})

describe('applyFilters', () => {
  const events = [
    show({ id: 1, venue: 'A', subscribed: true }),
    show({ id: 2, venue: 'B' }),
    show({ id: 3, venue: 'A', title: 'Other' }),
  ]

  it('combines venue, mine and query', () => {
    expect(applyFilters(events, { query: '', venue: 'A', mine: false }).map((e) => e.id)).toEqual([1, 3])
    expect(applyFilters(events, { query: '', venue: '', mine: true }).map((e) => e.id)).toEqual([1])
    expect(applyFilters(events, { query: 'oth', venue: 'A', mine: false }).map((e) => e.id)).toEqual([3])
  })
})
