import { describe, expect, it } from 'vitest'
import { ARROW_INSET, placeTip, TIP_GAP, VIEWPORT_MARGIN } from './placement'

const PHONE = { width: 360, height: 780 }
const TIP = { width: 280, height: 120 }
const button = (left: number, top: number) => ({ left, top, width: 44, height: 44 })

describe('placeTip', () => {
  it('centres the tip below the button when there is room', () => {
    const place = placeTip(button(158, 200), TIP, PHONE)
    expect(place.side).toBe('below')
    expect(place.top).toBe(200 + 44 + TIP_GAP)
    expect(place.left).toBe(180 - TIP.width / 2)
    expect(place.arrowLeft).toBe(TIP.width / 2)
  })

  it('goes above when the bottom of the screen is too close', () => {
    const place = placeTip(button(158, 700), TIP, PHONE)
    expect(place.side).toBe('above')
    expect(place.top).toBe(700 - TIP_GAP - TIP.height)
  })

  it('stays below when neither side has room, rather than leaving the screen at the top', () => {
    const place = placeTip(button(158, 60), { width: 280, height: 760 }, PHONE)
    expect(place.side).toBe('below')
  })

  it('keeps the whole tip on a 360px screen for a button at either edge', () => {
    for (const left of [0, 8, 300, 316]) {
      const place = placeTip(button(left, 300), TIP, PHONE)
      expect(place.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
      expect(place.left + TIP.width).toBeLessThanOrEqual(PHONE.width - VIEWPORT_MARGIN)
    }
  })

  it('keeps the arrow on the button when the box is pushed sideways', () => {
    const atLeftEdge = placeTip(button(8, 300), TIP, PHONE)
    expect(atLeftEdge.left + atLeftEdge.arrowLeft).toBe(8 + 22)

    const atRightEdge = placeTip(button(308, 300), TIP, PHONE)
    expect(atRightEdge.left + atRightEdge.arrowLeft).toBe(308 + 22)
  })

  it('never puts the arrow on the rounded corner', () => {
    const place = placeTip(button(-30, 300), TIP, PHONE)
    expect(place.arrowLeft).toBe(ARROW_INSET)
  })

  it('pins a tip wider than the screen to the left margin', () => {
    const place = placeTip(button(150, 300), { width: 400, height: 100 }, PHONE)
    expect(place.left).toBe(VIEWPORT_MARGIN)
  })
})
