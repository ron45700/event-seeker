import { venueProps } from '../lib/venueColor'
import styles from './VenueBadge.module.css'

interface Props {
  venue: string
  className?: string
}

/** The venue's name on its own colour, so the venue reads at a glance. */
export function VenueBadge({ venue, className }: Props) {
  return (
    <span className={`${styles.badge} ${className ?? ''}`} {...venueProps(venue)}>
      {/* Right-to-left even when the name starts with a Latin word ("Babu bar - תל אביב") */}
      <bdi dir="rtl">{venue}</bdi>
    </span>
  )
}
