import type { ReactNode } from 'react'
import styles from './StateMessage.module.css'

interface Action {
  label: string
  onClick?: () => void
  href?: string
}

interface Props {
  title: ReactNode
  children?: ReactNode
  action?: Action
  /** Smaller, start-aligned variant for use inside a panel. */
  compact?: boolean
  role?: 'alert' | 'status'
}

/** Empty, error and signed-out screens: what happened and what to do next. */
export function StateMessage({ title, children, action, compact, role }: Props) {
  return (
    <div className={styles.message} data-compact={compact || undefined} role={role}>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.body}>{children}</p>}
      {action &&
        (action.href ? (
          <a className={styles.action} href={action.href}>
            {action.label}
          </a>
        ) : (
          <button type="button" className={styles.action} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  )
}
