import { useState } from 'react'
import { cardImageSrc } from '../lib/images'
import type { ShowEvent } from '../lib/types'
import styles from './ShowCard.module.css'

// How far an image may stray from square before it is letterboxed instead of cropped.
const CROP_TOLERANCE = 0.2

type Fit = 'cover' | 'contain'

/**
 * The square art at the top of a card. A clearly non-square image is shown whole over a
 * blurred copy of itself; a missing or broken image becomes a typographic poster.
 */
export function CardArt({ event }: { event: ShowEvent }) {
  const src = cardImageSrc(event)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fit, setFit] = useState<Fit>('cover')

  if (!src || failed) {
    return (
      <div className={styles.poster} aria-hidden="true">
        <span className={styles.posterTitle}>
          <bdi>{event.title}</bdi>
        </span>
      </div>
    )
  }

  return (
    <>
      {fit === 'contain' && <img className={styles.backdrop} src={src} alt="" aria-hidden="true" />}
      <img
        className={styles.image}
        data-fit={fit}
        data-loaded={loaded || undefined}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          if (h > 0 && Math.abs(w / h - 1) > CROP_TOLERANCE) setFit('contain')
          setLoaded(true)
        }}
        onError={() => setFailed(true)}
      />
    </>
  )
}
