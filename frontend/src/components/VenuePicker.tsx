import { useId, useMemo, useState } from 'react'
import { normalize, type VenueChoice } from '../lib/search'
import { venueProps } from '../lib/venueColor'
import { CheckIcon, SearchIcon } from './icons'
import styles from './VenuePicker.module.css'

interface Props {
  choices: VenueChoice[]
  /** Selected venue names; empty means all venues. */
  selected: string[]
  onChange: (selected: string[]) => void
  /** Listed first, before the alphabetical rest (e.g. the venue of the event being followed). */
  pinned?: string[]
  /** Accessible name of the list. */
  label?: string
}

/**
 * Several venues out of a long list: a search field, "all venues", then one checkbox per
 * venue with its colour dot. Nothing selected means all venues, so "all venues" is checked
 * then and unchecking the last venue returns to it. Venues already selected when the list
 * opens come first, so a filter set earlier is visible at once; after that the order never
 * changes while picking, so the row under the finger stays put.
 */
export function VenuePicker({ choices, selected, onChange, pinned = [], label = 'מקומות' }: Props) {
  const [query, setQuery] = useState('')
  const listId = useId()
  const chosen = useMemo(() => new Set(selected), [selected])
  const [selectedAtOpen] = useState(selected)

  const ordered = useMemo(() => {
    const first = [...new Set([...pinned, ...selectedAtOpen])].filter((venue) => choices.some((c) => c.venue === venue))
    const firstSet = new Set(first)
    return [
      ...first.map((venue) => choices.find((c) => c.venue === venue)!),
      ...choices.filter((c) => !firstSet.has(c.venue)),
    ]
  }, [choices, pinned, selectedAtOpen])

  const needle = normalize(query)
  const visible = needle ? ordered.filter((c) => normalize(c.venue).includes(needle)) : ordered

  function toggle(venue: string) {
    onChange(chosen.has(venue) ? selected.filter((v) => v !== venue) : [...selected, venue])
  }

  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} width={20} height={20} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="חיפוש מקום"
          aria-label="חיפוש מקום"
          aria-controls={listId}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul id={listId} className={styles.list} role="group" aria-label={label}>
        {!needle && (
          <li>
            <label className={styles.option}>
              <input
                type="checkbox"
                className={styles.input}
                checked={selected.length === 0}
                onChange={() => onChange([])}
              />
              <span className={styles.box} aria-hidden="true">
                <CheckIcon width={16} height={16} />
              </span>
              <span className={styles.name}>כל המקומות</span>
            </label>
          </li>
        )}
        {visible.map(({ venue, count }) => (
          <li key={venue}>
            <label className={styles.option} {...venueProps(venue)}>
              <input
                type="checkbox"
                className={styles.input}
                checked={chosen.has(venue)}
                onChange={() => toggle(venue)}
              />
              <span className={styles.box} aria-hidden="true">
                <CheckIcon width={16} height={16} />
              </span>
              <span className={styles.dot} aria-hidden="true" />
              {/* Hebrew place names, even the ones that start with a Latin word ("Babu bar - תל אביב") */}
              <bdi dir="rtl" className={styles.name}>
                {venue}
              </bdi>
              {count !== undefined && (
                <span className={styles.count}>
                  {count}
                  <span className="sr-only"> אירועים</span>
                </span>
              )}
            </label>
          </li>
        ))}
        {visible.length === 0 && (
          <li className={styles.empty}>
            {choices.length === 0 ? 'אין עדיין מקומות ברשימה.' : <>אין מקום בשם &quot;<bdi>{query.trim()}</bdi>&quot;.</>}
          </li>
        )}
      </ul>
    </div>
  )
}

/** "כל המקומות", "בארבי", "בארבי ועוד 2": a picked set of venues in a few words. */
export function venueSummary(selected: string[]): string {
  if (selected.length === 0) return 'כל המקומות'
  if (selected.length === 1) return selected[0]
  return `${selected[0]} ועוד ${selected.length - 1 === 1 ? 'אחד' : selected.length - 1}`
}
