import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { isUnreachable } from '../lib/api'
import type { Venue } from '../lib/types'
import styles from './AddArtistForm.module.css'

interface Props {
  venues: Venue[]
  onAdd: (artist: string, venue: string | null) => Promise<void>
  /** Pre-filled, editable artist name (e.g. an event title). */
  initialArtist?: string
  /** Offered right after "any venue" (e.g. the venue of the event being followed). */
  suggestedVenue?: string
  hint?: ReactNode
  submitLabel?: string
  /** "card" sits on a page; "sheet" stacks the fields inside a sheet. */
  layout?: 'card' | 'sheet'
}

/** Artist name plus an optional venue, defaulting to any venue. */
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
  const [venue, setVenue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const others = venues.map((v) => v.venue).filter((name) => name !== suggestedVenue)
  const options = suggestedVenue ? [suggestedVenue, ...others] : others

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
      await onAdd(name, venue || null)
      setArtist('')
      setVenue('')
    } catch (err) {
      setError(isUnreachable(err) ? 'אין חיבור לשרת. האמן לא נוסף.' : 'האמן לא נוסף. אפשר לנסות שוב.')
    } finally {
      setBusy(false)
    }
  }

  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')

  return (
    <form className={styles.form} data-layout={layout} onSubmit={submit} noValidate>
      <div className={`${styles.field} ${styles.artistField}`}>
        <label htmlFor={`${id}-artist`} className={styles.label}>
          אמן או להקה
        </label>
        <input
          id={`${id}-artist`}
          className={styles.input}
          placeholder="למשל: אביתר בנאי"
          autoComplete="off"
          enterKeyHint="done"
          value={artist}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => setArtist(e.target.value)}
        />
        {hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
      <div className={`${styles.field} ${styles.venueField}`}>
        <label htmlFor={`${id}-venue`} className={styles.label}>
          מקום
        </label>
        <div className={styles.selectWrap}>
          <select id={`${id}-venue`} className={styles.select} value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">כל המקומות</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
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
