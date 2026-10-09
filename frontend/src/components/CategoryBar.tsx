import { categorySegments } from '../lib/categories'
import { hrefFor } from '../lib/router'
import styles from './CategoryBar.module.css'

/**
 * The category as one segmented group: "all events" (no category, the default), then each
 * category from the label map. Search, venue and the toggles are screen state and are kept
 * when the category changes.
 */
export function CategoryBar({ active }: { active: string | null }) {
  return (
    <nav className={styles.segments} aria-label="סוג אירוע">
      {categorySegments().map(({ category, label }) => (
        <a
          key={category ?? 'all'}
          href={hrefFor('shows', { category })}
          className={styles.segment}
          aria-current={active === category ? 'true' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
