import { describe, expect, it } from 'vitest'
import {
  customDateEnds,
  customDateValue,
  dateFilterLabel,
  dateFilterPhrase,
  dateRange,
  eventMonths,
  isDateFilter,
  israelToday,
  monthLabel,
} from './dates'

describe('israelToday', () => {
  it("is Israel's date, not the device's", () => {
    // 22:30 UTC on 10 Oct is already 11 Oct in Israel (UTC+3 in October).
    expect(israelToday(new Date('2026-10-10T22:30:00Z'))).toBe('2026-10-11')
    expect(israelToday(new Date('2026-10-10T20:30:00Z'))).toBe('2026-10-10')
  })
})

describe('dateRange', () => {
  const monday = '2026-10-12'
  const thursday = '2026-10-15'
  const saturday = '2026-10-17'

  it('today', () => {
    expect(dateRange('today', monday)).toEqual({ from: monday, to: monday })
  })

  it('the weekend is Thursday to Saturday, the coming one early in the week', () => {
    expect(dateRange('weekend', monday)).toEqual({ from: thursday, to: saturday })
    expect(dateRange('weekend', '2026-10-16')).toEqual({ from: '2026-10-16', to: saturday })
    expect(dateRange('weekend', saturday)).toEqual({ from: saturday, to: saturday })
    expect(dateRange('weekend', '2026-10-18')).toEqual({ from: '2026-10-22', to: '2026-10-24' }) // Sunday
  })

  it('this week runs to Saturday, this month to its last day', () => {
    expect(dateRange('week', monday)).toEqual({ from: monday, to: saturday })
    expect(dateRange('month', monday)).toEqual({ from: monday, to: '2026-10-31' })
    expect(dateRange('month', '2027-02-10')).toEqual({ from: '2027-02-10', to: '2027-02-28' })
  })

  it('a month, a day and a range', () => {
    expect(dateRange('2026-11', monday)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(dateRange('2026-11-03', monday)).toEqual({ from: '2026-11-03', to: '2026-11-03' })
    expect(dateRange('2026-11-10..2026-11-03', monday)).toEqual({ from: '2026-11-03', to: '2026-11-10' })
  })

  it('anything else is no filter', () => {
    expect(dateRange('', monday)).toBeNull()
    expect(dateRange('2026-02-30', monday)).toBeNull()
    expect(isDateFilter('2026-11-03..')).toBe(false)
    expect(isDateFilter('tomorrow')).toBe(false)
  })
})

describe('custom dates', () => {
  it('one end, or the same day twice, is a single day', () => {
    expect(customDateValue('2026-11-03', '')).toBe('2026-11-03')
    expect(customDateValue('', '2026-11-03')).toBe('2026-11-03')
    expect(customDateValue('2026-11-03', '2026-11-03')).toBe('2026-11-03')
    expect(customDateValue('', '')).toBe('')
  })

  it('two ends are a range in order', () => {
    expect(customDateValue('2026-11-10', '2026-11-03')).toBe('2026-11-03..2026-11-10')
    expect(customDateEnds('2026-11-03..2026-11-10')).toEqual({ from: '2026-11-03', to: '2026-11-10' })
    expect(customDateEnds('2026-11-03')).toEqual({ from: '2026-11-03', to: '2026-11-03' })
    expect(customDateEnds('weekend')).toEqual({ from: '', to: '' })
  })
})

describe('labels', () => {
  const today = '2026-10-12'

  it('names each kind of filter', () => {
    expect(dateFilterLabel('weekend', today)).toBe('סוף השבוע')
    expect(dateFilterLabel('2026-11', today)).toBe('נובמבר')
    expect(dateFilterLabel('2027-01', today)).toBe('ינואר 2027')
    expect(dateFilterLabel('2026-11-03', today)).toBe('3 בנוב׳')
    expect(dateFilterLabel('2026-11-03..2026-11-10', today)).toBe('3–10 בנוב׳')
    expect(dateFilterLabel('2026-10-28..2026-11-03', today)).toBe('28 באוק׳ – 3 בנוב׳')
  })

  it('reads inside a sentence', () => {
    expect(dateFilterPhrase('weekend', today)).toBe('בסוף השבוע')
    expect(dateFilterPhrase('today', today)).toBe('היום')
    expect(dateFilterPhrase('2026-11', today)).toBe('בנובמבר')
    expect(dateFilterPhrase('2026-11-03', today)).toBe('ב־3 בנוב׳')
  })

  it('lists the months that have events', () => {
    const events = [{ starts_at: '2026-11-02T20:00:00' }, { starts_at: '2026-10-15T21:00:00' }, { starts_at: '2026-11-20T21:00:00' }]
    expect(eventMonths(events)).toEqual(['2026-10', '2026-11'])
    expect(monthLabel('2026-10', today)).toBe('אוקטובר')
  })
})
