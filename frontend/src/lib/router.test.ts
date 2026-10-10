import { describe, expect, it } from 'vitest'
import { hrefFor, parseHash, showsHref, signInHref } from './router'
import { NO_FILTERS } from './search'

describe('parseHash', () => {
  it('reads the screen', () => {
    expect(parseHash('').name).toBe('shows')
    expect(parseHash('#/').name).toBe('shows')
    expect(parseHash('#/artists').name).toBe('artists')
    expect(parseHash('#/signin?next=%23%2F').name).toBe('signin')
    expect(parseHash('#/nowhere').name).toBe('shows')
  })

  it('reads the category and the event to follow', () => {
    const route = parseHash('#/?category=standup&follow=42')
    expect(route.category).toBe('standup')
    expect(route.follow).toBe(42)
    expect(parseHash('#/?follow=abc').follow).toBeNull()
  })

  it('accepts only an in-app hash as the place to return to', () => {
    expect(parseHash(`#/signin?next=${encodeURIComponent('#/?follow=7')}`).next).toBe('#/?follow=7')
    expect(parseHash(`#/signin?next=${encodeURIComponent('https://example.com')}`).next).toBeNull()
  })
})

describe('filters in the URL', () => {
  it('round-trips every filter', () => {
    const filters = {
      query: 'אביתר בנאי',
      venues: ['בארבי', 'זאפה תל אביב'],
      date: '2026-11-03..2026-11-10',
      mine: true,
      hideOffSale: true,
    }
    const route = parseHash(showsHref('music', filters))
    expect(route.filters).toEqual(filters)
    expect(route.category).toBe('music')
  })

  it('leaves no trace with no filters', () => {
    expect(showsHref(null, NO_FILTERS)).toBe('#/')
    expect(parseHash('#/').filters).toEqual(NO_FILTERS)
  })

  it('drops a date it does not understand', () => {
    expect(parseHash('#/?date=yesterday').filters.date).toBe('')
    expect(parseHash('#/?date=2026-13').filters.date).toBe('')
    expect(parseHash('#/?date=weekend').filters.date).toBe('weekend')
  })

  it('keeps the filters through sign-in and a follow', () => {
    const back = showsHref('standup', { ...NO_FILTERS, venues: ['בארבי'] }, { follow: 7 })
    const route = parseHash(parseHash(signInHref(back)).next!)
    expect(route.follow).toBe(7)
    expect(route.filters.venues).toEqual(['בארבי'])
  })
})

describe('hrefFor', () => {
  it('drops empty parameters', () => {
    expect(hrefFor('shows')).toBe('#/')
    expect(hrefFor('shows', { category: null, follow: undefined })).toBe('#/')
    expect(hrefFor('shows', { category: 'music' })).toBe('#/?category=music')
  })

  it('round-trips a return address through sign-in', () => {
    const back = hrefFor('shows', { category: 'music', follow: 12 })
    expect(parseHash(signInHref(back)).next).toBe(back)
  })
})
