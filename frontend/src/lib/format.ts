// Date and price formatting. starts_at is Israel local time with no timezone, so it is
// parsed by hand and never converted through the browser's timezone.

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const MONTHS_SHORT = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
]
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export interface LocalDateTime {
  year: number
  /** 1 to 12 */
  month: number
  day: number
  hour: number
  minute: number
}

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/

export function parseLocal(value: string): LocalDateTime | null {
  const match = ISO_LOCAL.exec(value)
  if (!match) return null
  const [, year, month, day, hour = '0', minute = '0'] = match
  return { year: +year, month: +month, day: +day, hour: +hour, minute: +minute }
}

export function weekday(date: LocalDateTime): string {
  return WEEKDAYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()]
}

export function monthName(date: LocalDateTime): string {
  return MONTHS[date.month - 1]
}

export function monthShort(date: LocalDateTime): string {
  return MONTHS_SHORT[date.month - 1]
}

export function timeOfDay(date: LocalDateTime): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.hour)}:${pad(date.minute)}`
}

/** "16 בנוב׳": used for the end of a multi-day festival. */
export function shortDate(date: LocalDateTime): string {
  return `${date.day} ב${monthShort(date)}`
}

/** "115 ₪" for a plain number or range, otherwise the source text unchanged. */
export function formatPrice(price: string | null): string | null {
  const text = price?.trim()
  if (!text) return null
  return /^\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?$/.test(text) ? `${text} ₪` : text
}

export interface MonthGroup<T> {
  /** "2026-10" */
  key: string
  label: string
  year: number
  items: T[]
}

/** Groups items that are already sorted by date into consecutive calendar months. */
export function groupByMonth<T extends { starts_at: string }>(items: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = []
  for (const item of items) {
    const date = parseLocal(item.starts_at)
    const key = date ? `${date.year}-${String(date.month).padStart(2, '0')}` : 'unknown'
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = {
        key,
        label: date ? monthName(date) : 'ללא תאריך',
        year: date?.year ?? 0,
        items: [],
      }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

/** Hebrew count with the singular form: "אירוע אחד", "12 אירועים". */
export function eventCount(n: number): string {
  return n === 1 ? 'אירוע אחד' : `${n} אירועים`
}

const ISRAEL_DATE = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** A UTC timestamp from the server ("2026-10-10T09:30:00Z") as an Israel date: "10 באוק׳ 2026". */
export function israelDate(utc: string): string {
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? '' : ISRAEL_DATE.format(date)
}
