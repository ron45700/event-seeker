import { useCallback, useState } from 'react'
import { eventCount } from '../lib/format'
import { useHeightVar } from '../lib/hooks'
import { activeFilterCount, type ShowFilters } from '../lib/search'
import { venueProps } from '../lib/venueColor'
import { CategoryBar } from './CategoryBar'
import { SlidersIcon } from './icons'
import styles from './FilterBar.module.css'
import { SearchField } from './SearchField'
import { Sheet, SheetButton } from './Sheet'
import { Toggle } from './Toggle'

interface Props {
  filters: ShowFilters
  onChange: (filters: ShowFilters) => void
  /** The current category, or null for all events. */
  category: string | null
  /** Venue chips: the venues with events in the current category. */
  venues: string[]
  signedIn: boolean
  /** Called when a signed-out visitor turns on "my artists only". */
  onMineNeedsSignIn: () => void
  /** Events matching the current filters, for the sheet's close button. */
  matching: number
}

/**
 * The filters under the header (whose search field is the one from tablet width up).
 *
 * Tablet and up: row 2 holds the category group on the right and the two toggles on the
 * left; row 3 is the venue chips. Both scroll away with the page; only the header sticks.
 *
 * Phone: the category group as a full-width segmented control, then a sticky bar with the
 * search and a button that opens a sheet with the venue chips and the toggles.
 */
export function FilterBar({ filters, onChange, category, venues, signedIn, onMineNeedsSignIn, matching }: Props) {
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
      {/* Row 2. Right-to-left, so the first child (the categories) is on the right. */}
      <div className={styles.categoryRow}>
        <CategoryBar active={category} />
        <div className={styles.rowToggles}>{toggles(false)}</div>
      </div>

      {/* Row 3, tablet and up. */}
      <div className={styles.venueRow}>{chips}</div>

      {/* Phone only: sticky search and the filter sheet. */}
      <div className={styles.phoneBar} ref={heightRef}>
        <SearchField className={styles.phoneSearch} value={filters.query} onChange={(query) => onChange({ ...filters, query })} />
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
