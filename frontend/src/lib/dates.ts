// The date filter on the events page. Event times are Israel local time with no timezone
// (see format.ts), so "today" is taken in Asia/Jerusalem as well, whatever the device's
// own timezone is, and all arithmetic is on calendar days ("YYYY-MM-DD" strings).
//
// A filter is one string, which is also its URL form (?date=...):
//   ''                        any date
//   today | weekend | week | month
//   2026-11                   a calendar month
//   2026-11-03                one day
//   2026-11-03..2026-11-10    an inclusive range

import { monthName, parseLocal, shortDate } from './format'

export type DatePreset = 'today' | 'weekend' | 'week' | 'month'

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'היום' },
  { value: 'weekend', label: 'סוף השבוע' },
  { value: 'week', label: 'השבוע' },
  { value: 'month', label: 'החודש' },
]

/** Inclusive calendar days, as "YYYY-MM-DD". */
export interface DayRange {
  from: string
  to: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const SATURDAY = 6
const THURSDAY = 4

/** Today's date in Israel, "YYYY-MM-DD". */
export function israelToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function toUtc(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = toUtc(day)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtc(date)
}

/** 0 = Sunday ... 6 = Saturday. */
function dayOfWeek(day: string): number {
  return toUtc(day).getUTCDay()
}

function lastOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return fromUtc(new Date(Date.UTC(y, m, 0)))
}

function isDay(value: string): boolean {
  return DAY.test(value) && fromUtc(toUtc(value)) === value
}

function isMonth(value: string): boolean {
  if (!MONTH.test(value)) return false
  const month = Number(value.slice(5))
  return month >= 1 && month <= 12
}

/** Whether a URL value is a filter this page understands. */
export function isDateFilter(value: string): boolean {
  if (DATE_PRESETS.some((p) => p.value === value) || isMonth(value) || isDay(value)) return true
  const [from, to, extra] = value.split('..')
  return extra === undefined && to !== undefined && isDay(from) && isDay(to)
}

/** The days a filter covers, or null for any date (or an unknown value). */
export function dateRange(value: string, today: string): DayRange | null {
  if (!value || !isDateFilter(value)) return null
  const weekday = dayOfWeek(today)
  switch (value) {
    case 'today':
      return { from: today, to: today }
    case 'weekend': {
      // The Israeli going-out weekend: Thursday night to Saturday. From Thursday on it
      // starts today; earlier in the week it is the coming one.
      const from = weekday >= THURSDAY ? today : addDays(today, THURSDAY - weekday)
      return { from, to: addDays(today, SATURDAY - weekday) }
    }
    case 'week':
      // The Israeli week ends on Saturday.
      return { from: today, to: addDays(today, SATURDAY - weekday) }
    case 'month':
      return { from: today, to: lastOfMonth(today.slice(0, 7)) }
  }
  if (isMonth(value)) return { from: `${value}-01`, to: lastOfMonth(value) }
  if (isDay(value)) return { from: value, to: value }
  const [a, b] = value.split('..')
  return a <= b ? { from: a, to: b } : { from: b, to: a }
}

/** The URL value for a custom day or range; '' when both ends are empty. */
export function customDateValue(from: string, to: string): string {
  const days = [from, to].filter(isDay).sort()
  if (days.length === 0) return ''
  if (days.length === 1 || days[0] === days[1]) return days[0]
  return `${days[0]}..${days[1]}`
}

/** The ends of a custom day or range, for the two date inputs; empty for anything else. */
export function customDateEnds(value: string): DayRange {
  if (isDay(value)) return { from: value, to: value }
  if (value.includes('..') && isDateFilter(value)) {
    const [from, to] = value.split('..')
    return { from, to }
  }
  return { from: '', to: '' }
}

/** Whether an event falls on any day of the range (a festival counts on every one of its days). */
export function inRange(event: { starts_at: string; ends_at: string | null }, range: DayRange): boolean {
  const start = event.starts_at.slice(0, 10)
  const end = event.ends_at && event.ends_at.slice(0, 10) > start ? event.ends_at.slice(0, 10) : start
  return start <= range.to && end >= range.from
}

/** The months that have events, as "YYYY-MM", in order. */
export function eventMonths(events: { starts_at: string }[]): string[] {
  return [...new Set(events.map((event) => event.starts_at.slice(0, 7)))].filter(isMonth).sort()
}

/** "נובמבר", with the year only when it is not the current one. */
export function monthLabel(month: string, today: string): string {
  const date = parseLocal(`${month}-01`)
  if (!date) return month
  return month.slice(0, 4) === today.slice(0, 4) ? monthName(date) : `${monthName(date)} ${date.year}`
}

/** The chip text for an active filter: "סוף השבוע", "נובמבר", "3 בנוב׳", "3–10 בנוב׳". */
export function dateFilterLabel(value: string, today: string): string {
  const preset = DATE_PRESETS.find((p) => p.value === value)
  if (preset) return preset.label
  if (isMonth(value)) return monthLabel(value, today)
  const range = dateRange(value, today)
  if (!range) return ''
  const from = parseLocal(range.from)
  const to = parseLocal(range.to)
  if (!from || !to) return ''
  if (range.from === range.to) return shortDate(from)
  if (from.year === to.year && from.month === to.month) return `${from.day}–${shortDate(to)}`
  return `${shortDate(from)} – ${shortDate(to)}`
}

/** The filter inside a sentence ("לא נמצא אירוע בסוף השבוע"): "היום", "בנובמבר", "ב־3 בנוב׳". */
export function dateFilterPhrase(value: string, today: string): string {
  switch (value) {
    case 'today':
      return 'היום'
    case 'weekend':
      return 'בסוף השבוע'
    case 'week':
      return 'השבוע'
    case 'month':
      return 'החודש'
  }
  const label = dateFilterLabel(value, today)
  if (!label) return ''
  if (isMonth(value)) return `ב${label}`
  return isDay(value) ? `ב־${label}` : `בתאריכים ${label}`
}
