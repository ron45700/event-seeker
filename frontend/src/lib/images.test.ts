import { describe, expect, it } from 'vitest'
import { cardImageSrc } from './images'
import type { ShowEvent } from './types'

const event = (image_url: string | null) => ({ id: 7, image_url }) as ShowEvent

describe('cardImageSrc', () => {
  it('returns null when the event has no image', () => {
    expect(cardImageSrc(event(null))).toBeNull()
  })

  it('points at the backend thumbnail', () => {
    expect(cardImageSrc(event('https://x/a.jpg'))).toMatch(/^\/api\/events\/7\/thumbnail\?v=[0-9a-z]+$/)
  })

  it('changes the URL when the source image changes, and only then', () => {
    expect(cardImageSrc(event('https://x/a.jpg'))).toBe(cardImageSrc(event('https://x/a.jpg')))
    expect(cardImageSrc(event('https://x/a.jpg'))).not.toBe(cardImageSrc(event('https://x/b.jpg')))
  })
})
