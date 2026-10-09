import { describe, expect, it } from 'vitest'
import { OFF_SALE_NOTICE, offSale, TICKETS_LEFT_THRESHOLD, ticketsLeftText } from './availability'

describe('ticketsLeftText', () => {
  const available = (tickets_left: number | null) => ({ availability: 'available' as const, tickets_left })

  it('shows a count at or below the threshold', () => {
    expect(TICKETS_LEFT_THRESHOLD).toBe(100)
    expect(ticketsLeftText(available(100))).toBe('נותרו 100 כרטיסים')
    expect(ticketsLeftText(available(55))).toBe('נותרו 55 כרטיסים')
  })

  it('uses the singular for one ticket', () => {
    expect(ticketsLeftText(available(1))).toBe('נותר כרטיס אחד')
  })

  it('shows nothing above the threshold, for zero, or without a count', () => {
    expect(ticketsLeftText(available(101))).toBeNull()
    expect(ticketsLeftText(available(267))).toBeNull()
    expect(ticketsLeftText(available(0))).toBeNull()
    expect(ticketsLeftText(available(null))).toBeNull()
  })

  it('shows no count unless the event is available', () => {
    expect(ticketsLeftText({ availability: 'sold_out', tickets_left: 0 })).toBeNull()
    expect(ticketsLeftText({ availability: null, tickets_left: 12 })).toBeNull()
  })
})

describe('offSale', () => {
  it('marks sold-out and unavailable events only', () => {
    expect(offSale({ availability: 'sold_out' })).toBe('sold_out')
    expect(offSale({ availability: 'unavailable' })).toBe('unavailable')
    expect(offSale({ availability: 'available' })).toBeNull()
    expect(offSale({ availability: null })).toBeNull()
  })

  it('labels "unavailable" without claiming it is sold out', () => {
    expect(OFF_SALE_NOTICE.sold_out.label).toBe('אזלו הכרטיסים')
    expect(OFF_SALE_NOTICE.unavailable.label).toBe('לא זמין')
  })

  it('ends both explanations with the advice to check the venue', () => {
    for (const notice of Object.values(OFF_SALE_NOTICE)) {
      expect(notice.explanation.endsWith('מומלץ תמיד לבדוק באתר המקום.')).toBe(true)
    }
  })
})
