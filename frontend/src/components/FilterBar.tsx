import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { eventCount } from '../lib/format'
import { useHeightVar, useMediaQuery } from '../lib/hooks'
import { activeFilterCount, filterChips, withoutPanelFilters, type ShowFilters, type VenueChoice } from '../lib/search'
import { venueProps } from '../lib/venueColor'
import { CategoryBar } from './CategoryBar'
import { FilterPanel } from './FilterPanel'
import { CloseIcon, SlidersIcon } from './icons'
import styles from './FilterBar.module.css'
import { SearchField } from './SearchField'
import { Sheet, SheetButton } from './Sheet'

interface Props {
  filters: ShowFilters
  onChange: (filters: ShowFilters) => void
  /** The current category, or null for all events. */
  category: string | null
  /** The venue picker's list: venues with events in the current category. */
  venues: VenueChoice[]
  /** Months with events in the current category, "YYYY-MM". */
  months: string[]
  /** Israel's date, "YYYY-MM-DD". */
  today: string
  signedIn: boolean
  /** Called when a signed-out visitor turns on "my artists only". */
  onMineNeedsSignIn: () => void
  /** Events matching the current filters, for the panel's close button. */
  matching: number
}

/**
 * The filters under the header (whose search field is the one from tablet width up).
 *
 * One "סינון" button at every width opens the date, venue and display filters: a sheet on
 * a phone, a popover under the button from tablet width up. With nothing set the page shows
 * only the button; active filters show beside it as chips that remove themselves, with
 * "ניקוי הכל". The chips wrap instead of scrolling sideways, which a mouse cannot do.
 *
 * Tablet and up: one row with the category group on the right and the button and chips
 * after it. Phone: the category group full width, then a sticky bar with the search and
 * the button, then the chips (when any).
 */
export function FilterBar({
  filters,
  onChange,
  category,
  venues,
  months,
  today,
  signedIn,
  onMineNeedsSignIn,
  matching,
}: Props) {
  const [open, setOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 600px)')
  const heightRef = useHeightVar('--filterbar-h')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const count = activeFilterCount(filters)
  const close = () => setOpen(false)

  const panel = (
    <FilterPanel
      filters={filters}
      onChange={onChange}
      venues={venues}
      months={months}
      today={today}
      signedIn={signedIn}
      onMineNeedsSignIn={onMineNeedsSignIn}
    />
  )
  const showLabel = matching > 0 ? `הצגת ${eventCount(matching)}` : 'סגירה'
  const chips = <ActiveChips filters={filters} today={today} onChange={onChange} />

  return (
    <>
      {/* Row 2. Right-to-left, so the first child (the categories) is on the right. */}
      <div className={styles.categoryRow}>
        <CategoryBar active={category} filters={filters} />
        <div className={styles.cluster}>
          <div className={styles.anchor}>
            <Trigger
              ref={triggerRef}
              count={count}
              expanded={open && wide}
              controls={open && wide ? popoverId : undefined}
              onClick={() => setOpen((v) => !v)}
            />
            {open && wide && (
              <Popover id={popoverId} triggerRef={triggerRef} onClose={close}>
                {panel}
                <div className={styles.popoverFooter}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={count === 0}
                    onClick={() => onChange(withoutPanelFilters(filters))}
                  >
                    ניקוי
                  </button>
                  <button type="button" className={styles.primary} onClick={close}>
                    {showLabel}
                  </button>
                </div>
              </Popover>
            )}
          </div>
          {chips}
        </div>
      </div>

      {/* Phone only: sticky search and the filter button, then the active filters. */}
      <div className={styles.phoneBar} ref={heightRef}>
        <SearchField className={styles.phoneSearch} value={filters.query} onChange={(query) => onChange({ ...filters, query })} />
        <Trigger count={count} expanded={open && !wide} onClick={() => setOpen(true)} dialog />
      </div>
      {count > 0 && <div className={styles.phoneChips}>{chips}</div>}

      <Sheet open={open && !wide} onClose={close} title="סינון">
        {panel}
        <SheetButton onClick={close}>{showLabel}</SheetButton>
      </Sheet>
    </>
  )
}

interface TriggerProps {
  count: number
  expanded: boolean
  onClick: () => void
  /** The popover it opens, while open. */
  controls?: string
  /** Opens a modal sheet rather than a popover. */
  dialog?: boolean
  ref?: RefObject<HTMLButtonElement | null>
}

function Trigger({ count, expanded, onClick, controls, dialog, ref }: TriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={dialog ? undefined : expanded}
      aria-controls={controls}
      data-active={count > 0 || undefined}
      onClick={onClick}
    >
      <SlidersIcon width={20} height={20} />
      <span>סינון</span>
      {count > 0 && (
        <span className={styles.count}>
          {count}
          <span className="sr-only"> פעילים</span>
        </span>
      )}
    </button>
  )
}

const POPOVER_EDGE = 16

interface PopoverProps {
  id: string
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  children: ReactNode
}

/**
 * A non-modal panel under the filter button. It scrolls with the page (the list behind
 * stays usable and updates live), is nudged sideways to stay on screen, and closes on
 * Escape, a click outside, or the button.
 */
function Popover({ id, triggerRef, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ shift: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    const shift =
      rect.left < POPOVER_EDGE
        ? POPOVER_EDGE - rect.left
        : rect.right > width - POPOVER_EDGE
          ? width - POPOVER_EDGE - rect.right
          : 0
    setFit({ shift, maxHeight: Math.max(320, window.innerHeight - rect.top - POPOVER_EDGE) })
    element.focus({ preventScroll: true })
  }, [])

  // The latest onClose, so the listeners are added once.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      closeRef.current()
      triggerRef.current?.focus()
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !triggerRef.current?.contains(target)) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [triggerRef])

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label="סינון"
      tabIndex={-1}
      className={styles.popover}
      style={fit ? { translate: `${fit.shift}px 0`, maxHeight: fit.maxHeight } : { visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}

interface ChipsProps {
  filters: ShowFilters
  today: string
  onChange: (filters: ShowFilters) => void
}

/** The active filters as chips that remove themselves, then "clear all". */
function ActiveChips({ filters, today, onChange }: ChipsProps) {
  const chips = filterChips(filters, today)
  if (chips.length === 0) return null
  return (
    <ul className={styles.chips} aria-label="סינון פעיל">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            className={styles.chip}
            {...(chip.venue ? venueProps(chip.venue) : {})}
            aria-label={`הסרת הסינון ${chip.text}`}
            onClick={() => onChange(chip.without)}
          >
            {chip.venue && <span className={styles.dot} aria-hidden="true" />}
            <bdi dir="rtl" className={styles.chipText}>
              {chip.text}
            </bdi>
            <CloseIcon width={16} height={16} />
          </button>
        </li>
      ))}
      <li>
        <button type="button" className={styles.clearAll} onClick={() => onChange(withoutPanelFilters(filters))}>
          ניקוי הכל
        </button>
      </li>
    </ul>
  )
}
