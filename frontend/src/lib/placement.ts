// Where a small tip box goes next to the button that opened it. Pure, so it is unit tested;
// InfoTip measures the DOM and applies the result with position: fixed.

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface TipPlacement {
  top: number
  left: number
  /** Below the button unless only above has room. */
  side: 'below' | 'above'
  /** The arrow's centre, from the tip box's left edge, so it still points at the button
   *  when the box has been pushed sideways to stay on screen. */
  arrowLeft: number
}

/** Space kept between the tip and the edge of the screen. */
export const VIEWPORT_MARGIN = 8
/** Space between the button and the tip (the arrow sits in it). */
export const TIP_GAP = 10
/** The arrow never comes closer than this to the tip's rounded corners. */
export const ARROW_INSET = 14

export function placeTip(anchor: Box, tip: Size, viewport: Size): TipPlacement {
  const below = anchor.top + anchor.height + TIP_GAP
  const above = anchor.top - TIP_GAP - tip.height
  const fitsBelow = below + tip.height <= viewport.height - VIEWPORT_MARGIN
  const fitsAbove = above >= VIEWPORT_MARGIN
  const side = fitsBelow || !fitsAbove ? 'below' : 'above'

  const centre = anchor.left + anchor.width / 2
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - tip.width)
  const left = clamp(centre - tip.width / 2, VIEWPORT_MARGIN, maxLeft)

  return {
    top: side === 'below' ? below : above,
    left,
    side,
    arrowLeft: clamp(centre - left, ARROW_INSET, tip.width - ARROW_INSET),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
