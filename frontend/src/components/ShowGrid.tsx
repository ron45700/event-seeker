import type { ShowEvent } from '../lib/types'
import { ShowCard } from './ShowCard'
import styles from './ShowGrid.module.css'

/** Card grid whose column count follows the width it is given, not the viewport. */
export function ShowGrid({ events }: { events: ShowEvent[] }) {
  return (
    <div className={styles.frame}>
      <ul className={styles.grid}>
        {events.map((event) => (
          <ShowCard key={event.id} event={event} />
        ))}
      </ul>
    </div>
  )
}
