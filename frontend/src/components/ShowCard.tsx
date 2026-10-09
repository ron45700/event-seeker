import { useId } from 'react'
import { OFF_SALE_NOTICE, offSale, ticketsLeftText } from '../lib/availability'
import { formatPrice, monthShort, parseLocal, shortDate, timeOfDay, weekday } from '../lib/format'
import type { ShowEvent } from '../lib/types'
import { venueProps } from '../lib/venueColor'
import { CardArt } from './CardArt'
import { StarIcon } from './icons'
import { InfoTip } from './InfoTip'
import styles from './ShowCard.module.css'
import { VenueBadge } from './VenueBadge'

const LINEUP_PREVIEW = 3

function lineup(artists: string[]): string {
  const shown = artists.slice(0, LINEUP_PREVIEW).join(', ')
  const rest = artists.length - LINEUP_PREVIEW
  return rest > 0 ? `${shown} ועוד ${rest}` : shown
}

interface Props {
  event: ShowEvent
  /** Opens the follow form for this event. Not offered on cards already followed. */
  onFollow?: (event: ShowEvent) => void
}

/**
 * An event as a ticket: poster art with the venue and date on top, details on the stub
 * below. The title link is stretched over the whole card, so a tap anywhere opens the
 * venue's page, while the follow and "i" buttons sit above it as their own targets.
 */
export function ShowCard({ event, onFollow }: Props) {
  const start = parseLocal(event.starts_at)
  const end = event.ends_at ? parseLocal(event.ends_at) : null
  const price = formatPrice(event.price)
  const people = event.artists.filter((name) => name.trim())
  const festival = event.kind === 'festival'
  const off = offSale(event)
  const ticketsLeft = ticketsLeftText(event)
  const titleId = useId()

  return (
    <li className={styles.card}>
      <article
        className={styles.ticket}
        aria-labelledby={titleId}
        data-subscribed={event.subscribed || undefined}
        data-off-sale={off ?? undefined}
        {...venueProps(event.venue)}
      >
        <div className={styles.art}>
          <CardArt event={event} />
          <VenueBadge venue={event.venue} className={styles.badge} />
          {event.subscribed ? (
            <span className={styles.follow}>
              <StarIcon filled width={14} height={14} />
              <span className={styles.followText}>במעקב</span>
            </span>
          ) : (
            onFollow && (
              <button
                type="button"
                className={styles.followButton}
                aria-label={`מעקב אחרי ${event.title}`}
                onClick={() => onFollow(event)}
              >
                <StarIcon width={20} height={20} />
              </button>
            )
          )}
          {off && <OffSaleStamp kind={off} />}
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
          <h3 id={titleId} className={styles.title}>
            <a className={styles.link} href={event.url} target="_blank" rel="noopener noreferrer">
              <bdi>{event.title}</bdi>
              <span className="sr-only"> (נפתח בלשונית חדשה)</span>
            </a>
          </h3>
          {people.length > 0 && (
            <p className={styles.people}>
              {festival ? '' : 'עם '}
              <bdi>{festival ? lineup(people) : people.join(', ')}</bdi>
            </p>
          )}
          {ticketsLeft && <p className={styles.ticketsLeft}>{ticketsLeft}</p>}
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
          {price && (off ? <s className={styles.price}>{price}</s> : <span className={styles.price}>{price}</span>)}
        </div>
      </article>
    </li>
  )
}

/** "Sold out" / "not available" stamped across the poster, with an "i" that explains it. */
function OffSaleStamp({ kind }: { kind: keyof typeof OFF_SALE_NOTICE }) {
  const notice = OFF_SALE_NOTICE[kind]
  return (
    <div className={styles.stamp}>
      <span className={styles.stampLabel}>{notice.label}</span>
      <InfoTip className={styles.info} label={`מה זה אומר: ${notice.label}`} text={notice.explanation} />
    </div>
  )
}
