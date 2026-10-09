import { useCallback, useState } from 'react'
import { eventCount } from '../lib/format'
import { useHeightVar } from '../lib/hooks'
import { activeFilterCount, type ShowFilters } from '../lib/search'
import { venueProps } from '../lib/venueColor'
import { CloseIcon, SearchIcon, SlidersIcon } from './icons'
import styles from './FilterBar.module.css'
import { Sheet, SheetButton } from './Sheet'
import { Toggle } from './Toggle'

interface Props {
  filters: ShowFilters
  onChange: (filters: ShowFilters) => void
  /** Venue chips: the venues with events in the current category. */
  venues: string[]
  signedIn: boolean
  /** Called when a signed-out visitor turns on "my artists only". */
  onMineNeedsSignIn: () => void
  /** Events matching the current filters, for the sheet's close button. */
  matching: number
}

/**
 * Sticky search and filters. On a phone the venue and toggle filters live in a bottom
 * sheet behind one button. From tablet width up: the search centred on the first row,
 * venue chips and toggles on the second.
 */
export function FilterBar({ filters, onChange, venues, signedIn, onMineNeedsSignIn, matching }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const heightRef = useHeightVar('--filterbar-h')
  const hidden = activeFilterCount(filters)

  const chips = <VenueChips venues={venues} selected={filters.venue} onSelect={(venue) => onChange({ ...filters, venue })} />
  const toggles = (stacked: boolean) => (
    <>
      <Toggle
        label="רק האמנים שלי"
        description={stacked ? (signedIn ? 'אירועים של אמנים שבמעקב' : 'זמין אחרי כניסה') : undefined}
        checked={signedIn && filters.mine}
        onChange={(mine) => (signedIn ? onChange({ ...filters, mine }) : onMineNeedsSignIn())}
      />
      <Toggle
        label="הסתר לא זמינים"
        description={stacked ? 'בלי אירועים שהכרטיסים להם אזלו או שאינם זמינים' : undefined}
        checked={filters.hideOffSale}
        onChange={(hideOffSale) => onChange({ ...filters, hideOffSale })}
      />
    </>
  )

  return (
    <>
      <div className={styles.bar} ref={heightRef}>
        <div className={styles.inner}>
          <div className={styles.search}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              className={styles.input}
              placeholder="חיפוש אמן או אירוע"
              aria-label="חיפוש אירועים"
              enterKeyHint="search"
              autoComplete="off"
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
            />
            {filters.query && (
              <button
                type="button"
                className={styles.clear}
                aria-label="ניקוי החיפוש"
                onClick={() => onChange({ ...filters, query: '' })}
              >
                <CloseIcon width={20} height={20} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={styles.sheetButton}
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
          >
            <SlidersIcon width={20} height={20} />
            <span>סינון</span>
            {hidden > 0 && (
              <span className={styles.count}>
                {hidden}
                <span className="sr-only"> פעילים</span>
              </span>
            )}
          </button>

          <div className={styles.venues}>{chips}</div>
          <div className={styles.toggles}>{toggles(false)}</div>
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="סינון">
        <div className={styles.sheetGroup}>
          <h3 className={styles.groupLabel}>מקום</h3>
          {chips}
        </div>
        <div className={styles.sheetToggles}>{toggles(true)}</div>
        <SheetButton onClick={() => setSheetOpen(false)}>
          {matching > 0 ? `הצגת ${eventCount(matching)}` : 'סגירה'}
        </SheetButton>
      </Sheet>
    </>
  )
}

interface ChipsProps {
  venues: string[]
  selected: string
  onSelect: (venue: string) => void
}

/** One row of venue chips that scrolls sideways instead of wrapping, fading at a cut edge. */
function VenueChips({ venues, selected, onSelect }: ChipsProps) {
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback((row: HTMLElement) => {
    // In a right-to-left row scrollLeft runs from 0 (start) to negative values (end). The
    // slack absorbs the few pixels scroll snapping leaves against the focus-ring padding.
    const SLACK = 8
    const scrolled = Math.abs(row.scrollLeft)
    const start = scrolled > SLACK
    const end = scrolled + row.clientWidth < row.scrollWidth - SLACK
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [])

  const rowRef = useCallback(
    (row: HTMLDivElement | null) => {
      if (!row) return
      const observer = new ResizeObserver(() => measure(row))
      observer.observe(row)
      return () => observer.disconnect()
    },
    [measure],
  )

  return (
    <div
      ref={rowRef}
      className={styles.chips}
      role="group"
      aria-label="מקום"
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
      onScroll={(e) => measure(e.currentTarget)}
    >
      <button type="button" className={styles.chip} aria-pressed={!selected} onClick={() => onSelect('')}>
        כל המקומות
      </button>
      {venues.map((venue) => (
        <button
          key={venue}
          type="button"
          className={styles.chip}
          {...venueProps(venue)}
          aria-pressed={selected === venue}
          onClick={() => onSelect(selected === venue ? '' : venue)}
        >
          <span className={styles.dot} aria-hidden="true" />
          <bdi>{venue}</bdi>
        </button>
      ))}
    </div>
  )
}
