import styles from './ShowGrid.module.css'

/** Placeholder cards while shows load. */
export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className={styles.frame} aria-busy="true">
      <span className="sr-only" role="status">
        טוען הופעות
      </span>
      <ul className={styles.grid} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={styles.skeleton}>
            <div className={styles.skeletonArt} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
          </li>
        ))}
      </ul>
    </div>
  )
}
