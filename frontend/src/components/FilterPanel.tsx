import { customDateEnds, customDateValue, DATE_PRESETS, monthLabel } from '../lib/dates'
import type { ShowFilters, VenueChoice } from '../lib/search'
import styles from './FilterPanel.module.css'
import { Toggle } from './Toggle'
import { VenuePicker } from './VenuePicker'

interface Props {
  filters: ShowFilters
  onChange: (filters: ShowFilters) => void
  venues: VenueChoice[]
  /** Months that have events, "YYYY-MM". */
  months: string[]
  /** Israel's date, "YYYY-MM-DD". */
  today: string
  signedIn: boolean
  onMineNeedsSignIn: () => void
}

/**
 * The filters behind the "סינון" button: date, venues and the two display toggles. The
 * same content goes in the phone's sheet and the popover from tablet width up. Every
 * change applies at once; the list behind updates while the panel is open.
 */
export function FilterPanel({ filters, onChange, venues, months, today, signedIn, onMineNeedsSignIn }: Props) {
  const ends = customDateEnds(filters.date)
  const setDate = (date: string) => onChange({ ...filters, date })

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend className={styles.label}>תאריך</legend>
        <div className={styles.pills}>
          {DATE_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={styles.pill}
              aria-pressed={filters.date === value}
              onClick={() => setDate(filters.date === value ? '' : value)}
            >
              {label}
            </button>
          ))}
        </div>

        {months.length > 0 && (
          <div className={styles.sub}>
            <span className={styles.subLabel} id="filter-months">
              חודש
            </span>
            <div className={styles.pills} role="group" aria-labelledby="filter-months">
              {months.map((month) => (
                <button
                  key={month}
                  type="button"
                  className={styles.pill}
                  aria-pressed={filters.date === month}
                  onClick={() => setDate(filters.date === month ? '' : month)}
                >
                  {monthLabel(month, today)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.sub}>
          <span className={styles.subLabel}>תאריך מסוים או טווח</span>
          <div className={styles.dates}>
            <label className={styles.dateField}>
              <span className={styles.dateLabel}>מתאריך</span>
              <input
                type="date"
                className={styles.dateInput}
                min={today}
                value={ends.from}
                onChange={(e) => setDate(customDateValue(e.target.value, ends.to))}
              />
            </label>
            <label className={styles.dateField}>
              <span className={styles.dateLabel}>עד תאריך</span>
              <input
                type="date"
                className={styles.dateInput}
                min={ends.from || today}
                value={ends.to}
                onChange={(e) => setDate(customDateValue(ends.from, e.target.value))}
              />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>
          מקום
          {filters.venues.length > 0 && <span className={styles.labelNote}> · {filters.venues.length} נבחרו</span>}
        </legend>
        <VenuePicker
          choices={venues}
          selected={filters.venues}
          onChange={(selected) => onChange({ ...filters, venues: selected })}
        />
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>הצגה</legend>
        <div className={styles.toggles}>
          <Toggle
            label="רק האמנים שלי"
            description={signedIn ? 'אירועים של אמנים שבמעקב' : 'זמין אחרי כניסה'}
            checked={signedIn && filters.mine}
            onChange={(mine) => (signedIn ? onChange({ ...filters, mine }) : onMineNeedsSignIn())}
          />
          <Toggle
            label="הסתר לא זמינים"
            description="בלי אירועים שהכרטיסים להם אזלו או שאינם זמינים"
            checked={filters.hideOffSale}
            onChange={(hideOffSale) => onChange({ ...filters, hideOffSale })}
          />
        </div>
      </fieldset>
    </div>
  )
}
