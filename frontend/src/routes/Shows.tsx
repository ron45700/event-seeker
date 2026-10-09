import { useDeferredValue, useMemo } from 'react'
import { FilterBar } from '../components/FilterBar'
import { ShowGrid } from '../components/ShowGrid'
import { SkeletonGrid } from '../components/SkeletonGrid'
import { StateMessage } from '../components/StateMessage'
import { isUnreachable } from '../lib/api'
import { groupByMonth, showCount } from '../lib/format'
import { useEvents } from '../lib/hooks'
import { hrefFor, navigate } from '../lib/router'
import { applyFilters, NO_FILTERS, type ShowFilters } from '../lib/search'
import { useSession } from '../lib/session'
import type { ShowEvent } from '../lib/types'
import styles from './Shows.module.css'

const NO_EVENTS: ShowEvent[] = []

interface Props {
  filters: ShowFilters
  onFiltersChange: (filters: ShowFilters) => void
}

/** Home: every upcoming show, by month, with search and filters. */
export function Shows({ filters, onFiltersChange }: Props) {
  const { me, ready } = useSession()
  // Wait for the session so the first response already carries the `subscribed` flags.
  const { state, retry } = useEvents(ready ? {} : null, me?.email ?? '')
  const query = useDeferredValue(filters.query)
  const signedIn = me !== null
  const mine = filters.mine && signedIn

  const events = state.status === 'ready' ? state.data : NO_EVENTS
  const venues = useMemo(
    () => [...new Set(events.map((event) => event.venue))].sort((a, b) => a.localeCompare(b, 'he')),
    [events],
  )
  const visible = useMemo(
    () => applyFilters(events, { query, venue: filters.venue, mine }),
    [events, query, filters.venue, mine],
  )
  const groups = useMemo(() => groupByMonth(visible), [visible])

  return (
    <>
      <h1 className="sr-only">כל ההופעות</h1>
      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        venues={venues}
        signedIn={signedIn}
        onMineNeedsSignIn={() => navigate('signin', 'shows')}
        matching={visible.length}
      />

      <div className={styles.content}>
        {state.status === 'loading' && (
          <div className={styles.loading}>
            <SkeletonGrid />
          </div>
        )}

        {state.status === 'error' && (
          <StateMessage
            role="alert"
            title="ההופעות לא נטענו"
            action={{ label: 'לנסות שוב', onClick: retry }}
          >
            {isUnreachable(state.error)
              ? 'אין חיבור לשרת. כדאי לבדוק שהחיבור ל־Tailscale פעיל.'
              : 'השרת החזיר שגיאה בבקשת ההופעות.'}
          </StateMessage>
        )}

        {state.status === 'ready' && events.length === 0 && (
          <StateMessage title="אין הופעות קרובות">
            הלוח מתעדכן מאתרי המקומות פעם בשעה.
          </StateMessage>
        )}

        {state.status === 'ready' && events.length > 0 && visible.length === 0 && (
          <NoMatches
            filters={{ ...filters, query, mine }}
            followsAnything={events.some((event) => event.subscribed)}
            onClear={() => onFiltersChange(NO_FILTERS)}
          />
        )}

        {groups.map((group) => (
          <section key={group.key} className={styles.month} aria-labelledby={`month-${group.key}`}>
            <h2 id={`month-${group.key}`} className={styles.monthHeading}>
              <span className={styles.monthName}>{group.label}</span>
              <span className={styles.monthYear}>{group.year}</span>
              <span className={styles.monthCount}>{showCount(group.items.length)}</span>
            </h2>
            <ShowGrid events={group.items} />
          </section>
        ))}
      </div>
    </>
  )
}

interface NoMatchesProps {
  filters: ShowFilters
  followsAnything: boolean
  onClear: () => void
}

function NoMatches({ filters, followsAnything, onClear }: NoMatchesProps) {
  if (filters.mine && !followsAnything && !filters.query && !filters.venue) {
    return (
      <StateMessage
        title="אין הופעות קרובות של האמנים שלך"
        action={{ label: 'לאמנים שלי', href: hrefFor('artists') }}
      >
        אפשר להוסיף אמנים למעקב ולקבל אימייל כשמתפרסמת הופעה חדשה.
      </StateMessage>
    )
  }

  return (
    <StateMessage title="אין הופעות שמתאימות" action={{ label: 'ניקוי החיפוש והסינון', onClick: onClear }}>
      {filters.query ? (
        <>
          {/* Straight quotes: curly ones mirror unpredictably around an isolated LTR name. */}
          לא נמצאה הופעה עבור "<bdi>{filters.query.trim()}</bdi>"
        </>
      ) : (
        'לא נמצאה הופעה'
      )}
      {filters.venue && (
        <>
          {' '}
          ב<bdi>{filters.venue}</bdi>
        </>
      )}
      {filters.mine && ' בין האמנים שלך'}.
    </StateMessage>
  )
}
