import { useEffect, useMemo, useState } from 'react'
import { AddArtistForm } from '../components/AddArtistForm'
import { CloseIcon, TrashIcon } from '../components/icons'
import { ShowGrid } from '../components/ShowGrid'
import { SkeletonGrid } from '../components/SkeletonGrid'
import { StateMessage } from '../components/StateMessage'
import { useToast } from '../components/Toast'
import { Toggle } from '../components/Toggle'
import { VenueBadge } from '../components/VenueBadge'
import { api, isUnreachable } from '../lib/api'
import { useEvents, useVenues, type Load } from '../lib/hooks'
import { hrefFor, signInHref } from '../lib/router'
import { atVenues } from '../lib/search'
import { useSession } from '../lib/session'
import { groupByArtist, type ArtistGroup } from '../lib/subscriptions'
import type { Me, Subscription } from '../lib/types'
import styles from './MyArtists.module.css'

/** Whose shows the side panel lists. justAdded adds the "alerts start now" note. */
interface Focus {
  artist: string
  /** Empty means any venue. */
  venues: string[]
  justAdded: boolean
}

export function MyArtists() {
  const { me, ready } = useSession()

  if (!ready) {
    return (
      <div className={styles.page}>
        <SkeletonGrid count={4} />
      </div>
    )
  }

  if (!me) {
    return (
      <StateMessage title="האמנים שלי" action={{ label: 'כניסה', href: signInHref(hrefFor('artists')) }}>
        כדי לעקוב אחרי אמנים ולקבל אימייל על הופעות חדשות, צריך להיכנס עם כתובת אימייל.
      </StateMessage>
    )
  }

  return <Following me={me} />
}

function Following({ me }: { me: Me }) {
  const { setPaused, signOut } = useSession()
  const toast = useToast()
  const venues = useVenues()
  const [list, setList] = useState<Load<Subscription[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [pauseBusy, setPauseBusy] = useState(false)

  useEffect(() => {
    let live = true
    setList({ status: 'loading' })
    api
      .subscriptions()
      .then((data) => live && setList({ status: 'ready', data }))
      .catch((error) => live && setList({ status: 'error', error }))
    return () => {
      live = false
    }
  }, [attempt])

  async function add(artist: string, venues: string[]) {
    const data = await api.addSubscription(artist, venues)
    setList({ status: 'ready', data })
    // What was stored, which can be wider than what was picked (see add_artist_venues).
    const name = artist.split(/\s+/).join(' ')
    const stored = groupByArtist(data).find((group) => group.artist === name)
    setFocus({ artist: name, venues: stored?.venues ?? venues, justAdded: true })
  }

  async function remove(group: ArtistGroup) {
    const results = await Promise.allSettled(group.ids.map((id) => api.deleteSubscription(id)))
    const removed = new Set(group.ids.filter((_, i) => results[i].status === 'fulfilled'))
    setList((prev) =>
      prev.status === 'ready' ? { status: 'ready', data: prev.data.filter((s) => !removed.has(s.id)) } : prev,
    )
    if (removed.size < group.ids.length) {
      toast({ message: <>ההסרה של <bdi>{group.artist}</bdi> לא הצליחה. אפשר לנסות שוב.</> })
      return
    }
    if (focus?.artist === group.artist) setFocus(null)
    toast({
      message: <>המעקב אחרי <bdi>{group.artist}</bdi> הוסר</>,
      action: {
        label: 'ביטול',
        run: () => {
          api
            .addSubscription(group.artist, group.venues)
            .then((data) => setList({ status: 'ready', data }))
            .catch(() => toast({ message: 'המעקב לא שוחזר. אפשר להוסיף אותו מחדש.' }))
        },
      },
    })
  }

  async function togglePause(paused: boolean) {
    setPauseBusy(true)
    try {
      await setPaused(paused)
    } catch {
      toast({ message: 'השינוי לא נשמר. אפשר לנסות שוב.' })
    } finally {
      setPauseBusy(false)
    }
  }

  const groups = useMemo(() => (list.status === 'ready' ? groupByArtist(list.data) : []), [list])

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>האמנים שלי</h1>

      <div className={styles.layout}>
        <div className={styles.formArea}>
          <AddArtistForm venues={venues} onAdd={add} />
        </div>

        <div className={styles.showsArea}>
          {focus ? (
            <ArtistShows
              key={`${focus.artist}|${focus.venues.join('|')}`}
              focus={focus}
              paused={me.paused}
              onClose={() => setFocus(null)}
            />
          ) : (
            groups.length > 0 && (
              <p className={styles.hint}>אפשר לבחור אמן מהרשימה כדי לראות את ההופעות הקרובות.</p>
            )
          )}
        </div>

        <section className={styles.listArea} aria-labelledby="following-heading">
          <h2 id="following-heading" className={styles.subheading}>
            במעקב
            {groups.length > 0 && <span className={styles.subcount}>{groups.length}</span>}
          </h2>

          {list.status === 'loading' && <p className={styles.muted}>טוען את הרשימה…</p>}

          {list.status === 'error' && (
            <StateMessage
              compact
              role="alert"
              title="הרשימה לא נטענה"
              action={{ label: 'לנסות שוב', onClick: () => setAttempt((n) => n + 1) }}
            >
              {isUnreachable(list.error) ? 'אין חיבור לשרת.' : 'השרת החזיר שגיאה.'}
            </StateMessage>
          )}

          {list.status === 'ready' && groups.length === 0 && (
            <StateMessage compact title="עדיין אין אמנים ברשימה">
              מוסיפים שם של אמן או להקה בטופס, ומקבלים אימייל כשמתפרסמת הופעה חדשה.
            </StateMessage>
          )}

          {groups.length > 0 && (
            <ul className={styles.list}>
              {groups.map((group) => {
                const selected = focus?.artist === group.artist
                return (
                  <li key={group.artist} className={styles.row}>
                    <button
                      type="button"
                      className={styles.rowMain}
                      aria-pressed={selected}
                      onClick={() =>
                        setFocus(selected ? null : { artist: group.artist, venues: group.venues, justAdded: false })
                      }
                    >
                      <bdi className={styles.artist}>{group.artist}</bdi>
                      <VenueList venues={group.venues} />
                    </button>
                    <button
                      type="button"
                      className={styles.delete}
                      aria-label={`הסרת ${group.artist} מהמעקב`}
                      onClick={() => void remove(group)}
                    >
                      <TrashIcon width={20} height={20} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={styles.settingsArea} aria-label="הגדרות">
          <div className={styles.setting}>
            <Toggle
              label="השהיית התראות"
              description={
                me.paused
                  ? 'ההתראות מושהות. לא יישלח אימייל עד שההשהיה תבוטל.'
                  : 'אימייל יישלח כשתתפרסם הופעה חדשה של אמן מהרשימה.'
              }
              checked={me.paused}
              disabled={pauseBusy}
              onChange={(paused) => void togglePause(paused)}
            />
          </div>
          <div className={styles.account}>
            <span className={styles.muted}>
              נכנסת בתור{' '}
              <bdi dir="ltr" className={styles.email}>
                {me.email}
              </bdi>
            </span>
            <button type="button" className={styles.secondary} onClick={() => void signOut()}>
              יציאה
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

/** An artist's venues as badges, or "any venue". */
function VenueList({ venues, className }: { venues: string[]; className?: string }) {
  if (venues.length === 0) return <span className={styles.anyVenue}>כל המקומות</span>
  return (
    <span className={`${styles.venues} ${className ?? ''}`}>
      {venues.map((venue) => (
        <VenueBadge key={venue} venue={venue} />
      ))}
    </span>
  )
}

function ArtistShows({ focus, paused, onClose }: { focus: Focus; paused: boolean; onClose: () => void }) {
  // The server's own matching on the name, so this is exactly what an alert would match;
  // the venues are matched here the way the alerts match them.
  const { state, retry } = useEvents({ q: focus.artist }, '')
  const shows = useMemo(
    () => (state.status === 'ready' ? state.data.filter((event) => atVenues(event, focus.venues)) : []),
    [state, focus.venues],
  )

  return (
    <section className={styles.panel} aria-labelledby="artist-shows-heading">
      <div className={styles.panelHeader}>
        <h2 id="artist-shows-heading" className={styles.panelHeading}>
          ההופעות הקרובות של <bdi>{focus.artist}</bdi>
        </h2>
        <button type="button" className={styles.iconButton} aria-label="סגירה" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {focus.venues.length > 0 && <VenueList venues={focus.venues} className={styles.panelVenue} />}

      {focus.justAdded && (
        <p className={styles.note}>
          {paused ? (
            'ההתראות מושהות, ולכן לא יישלח אימייל עד שההשהיה תבוטל.'
          ) : (
            <>
              מעכשיו יישלח אימייל על כל הופעה חדשה של <bdi>{focus.artist}</bdi>.
            </>
          )}{' '}
          הופעות שכבר בלוח לא שולחות אימייל, ולכן הן מופיעות כאן.
        </p>
      )}

      {state.status === 'loading' && <SkeletonGrid count={2} />}
      {state.status === 'error' && (
        <StateMessage compact role="alert" title="ההופעות לא נטענו" action={{ label: 'לנסות שוב', onClick: retry }}>
          {isUnreachable(state.error) ? 'אין חיבור לשרת.' : 'השרת החזיר שגיאה.'}
        </StateMessage>
      )}
      {state.status === 'ready' && shows.length === 0 && (
        <p className={styles.muted}>
          אין כרגע הופעות קרובות
          {focus.venues.length === 1 && (
            <>
              {' '}
              ב<bdi>{focus.venues[0]}</bdi>
            </>
          )}
          {focus.venues.length > 1 && ' במקומות האלה'}.
        </p>
      )}
      {state.status === 'ready' && shows.length > 0 && <ShowGrid events={shows} />}
    </section>
  )
}
