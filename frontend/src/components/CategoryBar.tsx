import { categorySegments } from '../lib/categories'
import { showsHref } from '../lib/router'
import type { ShowFilters } from '../lib/search'
import styles from './CategoryBar.module.css'

/**
 * The category as one segmented group: "all events" (no category, the default), then each
 * category from the label map. The search and filters are kept when the category changes.
 */
export function CategoryBar({ active, filters }: { active: string | null; filters: ShowFilters }) {
  return (
    <nav className={styles.segments} aria-label="סוג אירוע">
      {categorySegments().map(({ category, label }) => (
        <a
          key={category ?? 'all'}
          href={showsHref(category, filters)}
          className={styles.segment}
          aria-current={active === category ? 'true' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
