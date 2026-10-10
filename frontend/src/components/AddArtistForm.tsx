import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { api, isAbort, isUnreachable } from '../lib/api'
import { eventCount, parseLocal, shortDate } from '../lib/format'
import { atVenues } from '../lib/search'
import type { ShowEvent, Venue } from '../lib/types'
import styles from './AddArtistForm.module.css'
import { InfoTip } from './InfoTip'
import { VenuePicker, venueSummary } from './VenuePicker'

interface Props {
  venues: Venue[]
  /** `venues` empty means any venue. */
  onAdd: (artist: string, venues: string[]) => Promise<void>
  /** Pre-filled, editable artist name (e.g. an event title). */
  initialArtist?: string
  /** Listed first in the venue picker (e.g. the venue of the event being followed). */
  suggestedVenue?: string
  hint?: ReactNode
  submitLabel?: string
  /** "card" sits on a page; "sheet" stacks the fields inside a sheet. */
  layout?: 'card' | 'sheet'
}

const MATCH_HELP =
  'השם לא נבדק מול רשימת אמנים, ולכן חשוב לכתוב אותו בדיוק. התראה נשלחת כשהשם מופיע כמילים שלמות ' +
  'בשם האירוע או ברשימת המשתתפים: למשל, "אביתר בנאי" מתאים גם ל"אביתר בנאי והלהקה".'

/** Artist name plus any number of venues, defaulting to any venue. */
export function AddArtistForm({
  venues,
  onAdd,
  initialArtist = '',
  suggestedVenue,
  hint,
  submitLabel = 'הוספה',
  layout = 'card',
}: Props) {
  const [artist, setArtist] = useState(initialArtist)
  const [selected, setSelected] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const preview = useMatchPreview(artist, selected)

  const choices = useMemo(() => venues.map(({ venue }) => ({ venue })), [venues])
  const pinned = useMemo(() => (suggestedVenue ? [suggestedVenue] : []), [suggestedVenue])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = artist.trim()
    if (!name) {
      setError('צריך לכתוב שם של אמן או להקה.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd(name, selected)
      setArtist('')
      setSelected([])
      setPickerOpen(false)
    } catch (err) {
      setError(isUnreachable(err) ? 'אין חיבור לשרת. האמן לא נוסף.' : 'האמן לא נוסף. אפשר לנסות שוב.')
    } finally {
      setBusy(false)
    }
  }

  const describedBy = [hint ? `${id}-hint` : '', `${id}-preview`, error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ')

  return (
    <form className={styles.form} data-layout={layout} onSubmit={submit} noValidate>
      <div className={`${styles.field} ${styles.artistField}`}>
        <div className={styles.labelRow}>
          <label htmlFor={`${id}-artist`} className={styles.label}>
            אמן או להקה
          </label>
          <InfoTip variant="inline" className={styles.info} label="איך השם מותאם לאירועים" text={MATCH_HELP} />
        </div>
        <input
          id={`${id}-artist`}
          className={styles.input}
          placeholder="למשל: אביתר בנאי"
          autoComplete="off"
          enterKeyHint="done"
          value={artist}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => setArtist(e.target.value)}
        />
        {hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )}
        <MatchPreview id={`${id}-preview`} preview={preview} narrowed={selected.length > 0} />
      </div>

      <div className={`${styles.field} ${styles.venueField}`}>
        <span id={`${id}-venue-label`} className={styles.label}>
          מקום
        </span>
        <div className={styles.selectWrap} data-open={pickerOpen || undefined}>
          <button
            type="button"
            className={styles.select}
            aria-expanded={pickerOpen}
            aria-controls={`${id}-venues`}
            aria-labelledby={`${id}-venue-label ${id}-venue-value`}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <bdi id={`${id}-venue-value`} className={styles.selectValue}>
              {venueSummary(selected)}
            </bdi>
          </button>
        </div>
        {pickerOpen && (
          <div id={`${id}-venues`} className={styles.picker}>
            <VenuePicker
              choices={choices}
              selected={selected}
              onChange={setSelected}
              pinned={pinned}
              label="מקומות למעקב"
            />
          </div>
        )}
      </div>

      <button type="submit" className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
        {submitLabel}
      </button>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

type Preview =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: ShowEvent[] }

/** Wait this long after the last keystroke before asking the server. */
const PREVIEW_DELAY_MS = 400
const PREVIEW_MIN_LENGTH = 2
const PREVIEW_SHOWN = 4

/**
 * The listed events the name would match right now. /api/events?q= runs the same matching
 * as the alerts (whole words in the title or the guest list); the venues are applied here,
 * the way a subscription's venue is matched, so changing them needs no new request.
 */
function useMatchPreview(artist: string, venues: string[]): Preview {
  const name = artist.trim()
  const [answer, setAnswer] = useState<{ name: string; events: ShowEvent[] | null } | null>(null)

  useEffect(() => {
    if (name.length < PREVIEW_MIN_LENGTH) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api
        .events({ q: name }, controller.signal)
        .then((events) => setAnswer({ name, events }))
        .catch((error) => {
          if (!isAbort(error)) setAnswer({ name, events: null })
        })
    }, PREVIEW_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [name])

  if (name.length < PREVIEW_MIN_LENGTH) return { status: 'idle' }
  if (!answer || answer.name !== name) return { status: 'loading' }
  if (answer.events === null) return { status: 'error' }
  return { status: 'ready', events: answer.events.filter((event) => atVenues(event, venues)) }
}

function MatchPreview({ id, preview, narrowed }: { id: string; preview: Preview; narrowed: boolean }) {
  const where = narrowed ? ' במקומות שנבחרו' : ''
  return (
    // Announced once the answer arrives, not while it is loading.
    <div id={id} className={styles.preview} aria-live="polite" aria-busy={preview.status === 'loading'}>
      {preview.status === 'loading' && <p className={styles.previewNote}>בודק מה יש בלוח…</p>}
      {preview.status === 'error' && <p className={styles.previewNote}>לא הצלחנו לבדוק את הלוח כרגע.</p>}
      {preview.status === 'ready' && preview.events.length === 0 && (
        <p className={styles.previewNote}>
          אין כרגע בלוח אירועים עם השם הזה{where}. זה לא אומר שהוא שגוי: ייתכן שעוד לא פורסמו הופעות,
          וכשיתפרסמו יישלח אימייל. כדאי רק לוודא שהשם כתוב נכון.
        </p>
      )}
      {preview.status === 'ready' && preview.events.length > 0 && (
        <>
          <p className={styles.previewNote}>
            <strong className={styles.previewCount}>{eventCount(preview.events.length)}</strong> בלוח{' '}
            {preview.events.length === 1 ? 'מתאים' : 'מתאימים'} לשם הזה{where}:
          </p>
          <ul className={styles.previewList}>
            {preview.events.slice(0, PREVIEW_SHOWN).map((event) => {
              const date = parseLocal(event.starts_at)
              return (
                <li key={event.id} className={styles.previewItem}>
                  <bdi className={styles.previewTitle}>{event.title}</bdi>
                  <span className={styles.previewMeta}>
                    {date && shortDate(date)} · <bdi dir="rtl">{event.venue}</bdi>
                  </span>
                </li>
              )
            })}
          </ul>
          {preview.events.length > PREVIEW_SHOWN && (
            <p className={styles.previewNote}>ועוד {preview.events.length - PREVIEW_SHOWN}.</p>
          )}
        </>
      )}
    </div>
  )
}
