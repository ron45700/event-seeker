import { CATEGORY_LABELS } from '../lib/categories'
import { hrefFor } from '../lib/router'
import styles from './CategoryBar.module.css'

/**
 * Category buttons under the header. Picking a category narrows the list; picking the
 * active one again (or "all events" in the nav) clears it. Search, venue and the toggles
 * are screen state and are kept either way.
 */
export function CategoryBar({ active }: { active: string | null }) {
  return (
    <nav className={styles.bar} aria-label="קטגוריות">
      {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
        const current = active === category
        return (
          <a
            key={category}
            href={current ? hrefFor('shows') : hrefFor('shows', { category })}
            className={styles.category}
            aria-current={current ? 'true' : undefined}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}
