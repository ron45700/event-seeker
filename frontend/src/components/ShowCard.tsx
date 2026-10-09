import { formatPrice, monthShort, parseLocal, shortDate, timeOfDay, weekday } from '../lib/format'
import type { ShowEvent } from '../lib/types'
import { venueStyle } from '../lib/venueColor'
import { CardArt } from './CardArt'
import { StarIcon } from './icons'
import styles from './ShowCard.module.css'
import { VenueBadge } from './VenueBadge'

const LINEUP_PREVIEW = 3

function lineup(artists: string[]): string {
  const shown = artists.slice(0, LINEUP_PREVIEW).join(', ')
  const rest = artists.length - LINEUP_PREVIEW
  return rest > 0 ? `${shown} ועוד ${rest}` : shown
}

/** A show as a ticket: poster art with the venue and date on top, details on the stub below. */
export function ShowCard({ event }: { event: ShowEvent }) {
  const start = parseLocal(event.starts_at)
  const end = event.ends_at ? parseLocal(event.ends_at) : null
  const price = formatPrice(event.price)
  const people = event.artists.filter((name) => name.trim())
  const festival = event.kind === 'festival'

  return (
    <li className={styles.card}>
      <a
        className={styles.link}
        href={event.url}
        target="_blank"
        rel="noopener noreferrer"
        data-subscribed={event.subscribed || undefined}
        style={venueStyle(event.venue)}
      >
        <div className={styles.ticket}>
          <div className={styles.art}>
            <CardArt event={event} />
            <VenueBadge venue={event.venue} className={styles.badge} />
            {event.subscribed && (
              <span className={styles.follow}>
                <StarIcon filled width={14} height={14} />
                <span className={styles.followText}>במעקב</span>
              </span>
            )}
            {start && (
              <span className={styles.stub}>
                <span className={styles.day}>{start.day}</span>
                <span className={styles.month}>{monthShort(start)}</span>
              </span>
            )}
          </div>

          <div className={styles.body}>
            {festival && (
              <span className={styles.kind}>
                פסטיבל{end && <span className={styles.until}>עד {shortDate(end)}</span>}
              </span>
            )}
            <h3 className={styles.title}>
              <bdi>{event.title}</bdi>
            </h3>
            {people.length > 0 && (
              <p className={styles.people}>
                {festival ? '' : 'עם '}
                <bdi>{festival ? lineup(people) : people.join(', ')}</bdi>
              </p>
            )}
          </div>

          <div className={styles.perforation} aria-hidden="true" />

          <div className={styles.meta}>
            {start && (
              <span className={styles.when}>
                <span className={styles.weekday}>{weekday(start)}</span>
                <time className={styles.time} dateTime={event.starts_at}>
                  {timeOfDay(start)}
                </time>
              </span>
            )}
            {price && <span className={styles.price}>{price}</span>}
          </div>
        </div>
        <span className="sr-only">(נפתח בלשונית חדשה)</span>
      </a>
    </li>
  )
}
