import { describe, expect, it } from 'vitest'
import { hrefFor, parseHash, signInHref } from './router'

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
