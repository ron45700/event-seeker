import type { ShowEvent } from './types'

/** Ticket counts above this are not shown: a big number says nothing useful. */
export const TICKETS_LEFT_THRESHOLD = 100

const CHECK_THE_VENUE = 'מומלץ תמיד לבדוק באתר המקום.'

export type OffSale = 'sold_out' | 'unavailable'

/** The stamp on a card that can no longer be bought, and its "i" explanation. */
export const OFF_SALE_NOTICE: Record<OffSale, { label: string; explanation: string }> = {
  sold_out: {
    label: 'אזלו הכרטיסים',
    explanation: `לפי אתר המקום, הכרטיסים אזלו. ${CHECK_THE_VENUE}`,
  },
  unavailable: {
    label: 'לא זמין',
    explanation: `האתר מסמן את האירוע כלא זמין. ייתכן שהכרטיסים אזלו וייתכן שהמכירה נסגרה. ${CHECK_THE_VENUE}`,
  },
}

export function offSale(event: Pick<ShowEvent, 'availability'>): OffSale | null {
  return event.availability === 'sold_out' || event.availability === 'unavailable'
    ? event.availability
    : null
}

/** "נותרו 12 כרטיסים" for an available event with few tickets left, otherwise null. */
export function ticketsLeftText(event: Pick<ShowEvent, 'availability' | 'tickets_left'>): string | null {
  const left = event.tickets_left
  if (event.availability !== 'available' || left === null || !Number.isInteger(left)) return null
  if (left < 1 || left > TICKETS_LEFT_THRESHOLD) return null
  return left === 1 ? 'נותר כרטיס אחד' : `נותרו ${left} כרטיסים`
}
