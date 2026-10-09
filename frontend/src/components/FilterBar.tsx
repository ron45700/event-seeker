import { useState } from 'react'
import { showCount } from '../lib/format'
import { useHeightVar } from '../lib/hooks'
import { activeFilterCount, type ShowFilters } from '../lib/search'
import { venueStyle } from '../lib/venueColor'
import { FilterSheet } from './FilterSheet'
import { CloseIcon, SearchIcon, SlidersIcon } from './icons'
import styles from './FilterBar.module.css'
import { Toggle } from './Toggle'

interface Props {
  filters: ShowFilters
  onChange: (filters: ShowFilters) => void
  venues: string[]
  signedIn: boolean
  /** Called when a signed-out visitor turns on "my artists only". */
  onMineNeedsSignIn: () => void
  /** Shows matching the current filters, for the sheet's close button. */
  matching: number
}

/**
 * Sticky search and filters. On a phone the venue and "my artists" filters live in a
 * bottom sheet behind one button; from tablet width up they sit inline.
 */
export function FilterBar({ filters, onChange, venues, signedIn, onMineNeedsSignIn, matching }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const heightRef = useHeightVar('--filterbar-h')
  const hidden = activeFilterCount(filters)
  const controls = { filters, onChange, venues, signedIn, onMineNeedsSignIn }

  return (
    <>
      <div className={styles.bar} ref={heightRef}>
        <div className={styles.inner}>
          <div className={styles.search}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              className={styles.input}
              placeholder="חיפוש אמן או הופעה"
              aria-label="חיפוש הופעות"
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

          <div className={styles.inline}>
            <FilterControls {...controls} />
          </div>
        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        doneLabel={matching > 0 ? `הצגת ${showCount(matching)}` : 'סגירה'}
      >
        <FilterControls {...controls} stacked />
      </FilterSheet>
    </>
  )
}

interface ControlsProps extends Omit<Props, 'matching'> {
  stacked?: boolean
}

function FilterControls({ filters, onChange, venues, signedIn, onMineNeedsSignIn, stacked }: ControlsProps) {
  return (
    <div className={styles.controls} data-stacked={stacked || undefined}>
      <div className={styles.group}>
        {stacked && <h3 className={styles.groupLabel}>מקום</h3>}
        <div className={styles.chips} role="group" aria-label="מקום">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={!filters.venue}
            onClick={() => onChange({ ...filters, venue: '' })}
          >
            כל המקומות
          </button>
          {venues.map((venue) => (
            <button
              key={venue}
              type="button"
              className={styles.chip}
              data-venue
              style={venueStyle(venue)}
              aria-pressed={filters.venue === venue}
              onClick={() => onChange({ ...filters, venue: filters.venue === venue ? '' : venue })}
            >
              <span className={styles.dot} aria-hidden="true" />
              <bdi>{venue}</bdi>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mine}>
        <Toggle
          label="רק האמנים שלי"
          description={stacked ? (signedIn ? 'הופעות של אמנים שבמעקב' : 'זמין אחרי כניסה') : undefined}
          checked={signedIn && filters.mine}
          onChange={(mine) => (signedIn ? onChange({ ...filters, mine }) : onMineNeedsSignIn())}
        />
      </div>
    </div>
  )
}
