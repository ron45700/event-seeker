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
      <bdi>{venue}</bdi>
    </span>
  )
}
