import { describe, expect, it } from 'vitest'
import { eventCount, formatPrice, groupByMonth, israelDate, parseLocal, shortDate, timeOfDay, weekday } from './format'

describe('parseLocal', () => {
  it('reads the wall-clock time without timezone conversion', () => {
    const date = parseLocal('2026-11-13T21:30:00')!
    expect(date).toEqual({ year: 2026, month: 11, day: 13, hour: 21, minute: 30 })
    expect(timeOfDay(date)).toBe('21:30')
  })

  it('rejects text that is not an ISO date', () => {
    expect(parseLocal('soon')).toBeNull()
  })

  it('names the Hebrew weekday', () => {
    // 10 October 2026 is a Saturday.
    expect(weekday(parseLocal('2026-10-10T21:00:00')!)).toBe('שבת')
  })

  it('formats a festival end date', () => {
    expect(shortDate(parseLocal('2026-11-16T00:00:00')!)).toBe('16 בנוב׳')
  })
})

describe('formatPrice', () => {
  it('adds the shekel sign to a number', () => {
    expect(formatPrice('115')).toBe('115 ₪')
    expect(formatPrice('85-120')).toBe('85-120 ₪')
  })

  it('keeps free text as is and drops empty values', () => {
    expect(formatPrice('כניסה חופשית')).toBe('כניסה חופשית')
    expect(formatPrice(null)).toBeNull()
    expect(formatPrice('  ')).toBeNull()
  })
})

describe('groupByMonth', () => {
  it('groups consecutive months in order', () => {
    const groups = groupByMonth([
      { starts_at: '2026-10-10T21:00:00' },
      { starts_at: '2026-10-30T21:00:00' },
      { starts_at: '2027-01-02T20:00:00' },
    ])
    expect(groups.map((g) => [g.key, g.label, g.year, g.items.length])).toEqual([
      ['2026-10', 'אוקטובר', 2026, 2],
      ['2027-01', 'ינואר', 2027, 1],
    ])
  })
})

describe('eventCount', () => {
  it('uses the singular form for one', () => {
    expect(eventCount(1)).toBe('אירוע אחד')
    expect(eventCount(12)).toBe('12 אירועים')
  })
})

describe('israelDate', () => {
  it('shows a UTC timestamp as the date in Israel', () => {
    // 22:30 UTC on 10 Oct is already 11 Oct in Israel.
    expect(israelDate('2026-10-10T22:30:00Z')).toBe(israelDate('2026-10-11T08:00:00Z'))
    expect(israelDate('2026-10-10T22:30:00Z')).toContain('11')
    expect(israelDate('nonsense')).toBe('')
  })
})
