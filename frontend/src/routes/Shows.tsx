import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FilterBar } from '../components/FilterBar'
import { FollowSheet } from '../components/FollowSheet'
import { ShowGrid } from '../components/ShowGrid'
import { SkeletonGrid } from '../components/SkeletonGrid'
import { StateMessage } from '../components/StateMessage'
import { useToast } from '../components/Toast'
import { isUnreachable } from '../lib/api'
import { CATEGORY_LABELS, categoryFromParam } from '../lib/categories'
import { eventCount, groupByMonth } from '../lib/format'
import { useEvents } from '../lib/hooks'
import { hrefFor, navigate, replaceRoute, signInHref, type Route } from '../lib/router'
import { applyFilters, inCategory, NO_FILTERS, venueChoices, type ShowFilters } from '../lib/search'
import { useSession } from '../lib/session'
import type { ShowEvent } from '../lib/types'
import styles from './Shows.module.css'

const NO_EVENTS: ShowEvent[] = []

interface Props {
  route: Route
  filters: ShowFilters
  onFiltersChange: (filters: ShowFilters) => void
}

/** Home: every upcoming event, by month, with categories, search and filters. */
export function Shows({ route, filters, onFiltersChange }: Props) {
  const { me, ready } = useSession()
  const toast = useToast()
  // Wait for the session so the first response already carries the `subscribed` flags.
  const { state, retry, refresh } = useEvents(ready ? {} : null, me?.email ?? '')
  const category = categoryFromParam(route.category)
  const query = useDeferredValue(filters.query)
  const signedIn = me !== null
  const mine = filters.mine && signedIn
  const [following, setFollowing] = useState<ShowEvent | null>(null)

  const events = state.status === 'ready' ? state.data : NO_EVENTS
  const categoryEvents = useMemo(() => inCategory(events, category), [events, category])
  const venues = useMemo(() => venueChoices(categoryEvents, filters.venue), [categoryEvents, filters.venue])
  const { venue, hideOffSale } = filters
  const visible = useMemo(
    () => applyFilters(categoryEvents, { query, venue, mine, hideOffSale }),
    [categoryEvents, query, venue, mine, hideOffSale],
  )
  const groups = useMemo(() => groupByMonth(visible), [visible])

  function startFollow(event: ShowEvent) {
    if (signedIn) setFollowing(event)
    else navigate(signInHref(hrefFor('shows', { category, follow: event.id })))
  }

  // Back from sign-in with ?follow=<id>: drop the parameter and open the form for that event.
  const followId = route.follow
  useEffect(() => {
    if (followId === null || state.status !== 'ready') return
    replaceRoute(hrefFor('shows', { category }))
    const event = state.data.find((e) => e.id === followId)
    if (event && signedIn && !event.subscribed) setFollowing(event)
  }, [followId, state, signedIn, category])

  return (
    <>
      <h1 className="sr-only">{category ? CATEGORY_LABELS[category] : 'כל האירועים'}</h1>
      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        category={category}
        venues={venues}
        signedIn={signedIn}
        onMineNeedsSignIn={() => navigate(signInHref(hrefFor('shows', { category })))}
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
            title="האירועים לא נטענו"
            action={{ label: 'לנסות שוב', onClick: retry }}
          >
            {isUnreachable(state.error)
              ? 'אין חיבור לשרת. כדאי לבדוק שהחיבור ל־Tailscale פעיל.'
              : 'השרת החזיר שגיאה בבקשת האירועים.'}
          </StateMessage>
        )}

        {state.status === 'ready' && events.length === 0 && (
          <StateMessage title="אין אירועים קרובים">הלוח מתעדכן מאתרי המקומות פעם בשעה.</StateMessage>
        )}

        {state.status === 'ready' && events.length > 0 && category && categoryEvents.length === 0 && (
          <StateMessage
            title={`עדיין אין כאן אירועי ${CATEGORY_LABELS[category]}`}
            action={{ label: 'לכל האירועים', href: hrefFor('shows') }}
          >
            אף אחד מהמקומות לא פרסם עדיין אירועים מהסוג הזה. הלוח מתעדכן פעם בשעה, והם יופיעו כאן
            כשיתפרסמו.
          </StateMessage>
        )}

        {state.status === 'ready' && categoryEvents.length > 0 && visible.length === 0 && (
          <NoMatches
            filters={{ ...filters, query, mine }}
            category={category}
            followsAnything={categoryEvents.some((event) => event.subscribed)}
            onClear={() => onFiltersChange(NO_FILTERS)}
          />
        )}

        {groups.map((group) => (
          <section key={group.key} className={styles.month} aria-labelledby={`month-${group.key}`}>
            <h2 id={`month-${group.key}`} className={styles.monthHeading}>
              <span className={styles.monthName}>{group.label}</span>
              <span className={styles.monthYear}>{group.year}</span>
              <span className={styles.monthCount}>{eventCount(group.items.length)}</span>
            </h2>
            <ShowGrid events={group.items} onFollow={startFollow} />
          </section>
        ))}
      </div>

      <FollowSheet
        event={following}
        onClose={() => setFollowing(null)}
        onFollowed={(artist) => {
          setFollowing(null)
          toast({ message: <>המעקב אחרי <bdi>{artist}</bdi> נוסף</> })
          refresh()
        }}
      />
    </>
  )
}

interface NoMatchesProps {
  filters: ShowFilters
  category: string | null
  followsAnything: boolean
  onClear: () => void
}

function NoMatches({ filters, category, followsAnything, onClear }: NoMatchesProps) {
  const onlyMine = filters.mine && !filters.query && !filters.venue && !filters.hideOffSale
  if (onlyMine && !followsAnything) {
    return (
      <StateMessage
        title="אין אירועים קרובים של האמנים שלך"
        action={{ label: 'לאמנים שלי', href: hrefFor('artists') }}
      >
        אפשר להוסיף אמנים למעקב ולקבל אימייל כשמתפרסם אירוע חדש.
      </StateMessage>
    )
  }

  return (
    <StateMessage title="אין אירועים שמתאימים" action={{ label: 'ניקוי החיפוש והסינון', onClick: onClear }}>
      לא נמצא אירוע
      {filters.query && (
        <>
          {/* Straight quotes: curly ones mirror unpredictably around an isolated LTR name. */}
          {' '}עבור "<bdi>{filters.query.trim()}</bdi>"
        </>
      )}
      {category && <> בקטגוריה {CATEGORY_LABELS[category]}</>}
      {filters.venue && (
        <>
          {' '}ב<bdi>{filters.venue}</bdi>
        </>
      )}
      {filters.mine && ' בין האמנים שלך'}
      {filters.hideOffSale && ' שעדיין אפשר לקנות אליו כרטיסים'}.
    </StateMessage>
  )
}
