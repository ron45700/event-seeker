import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import styles from './FilterSheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  doneLabel: string
  children: ReactNode
}

/** A bottom sheet on a native modal <dialog>: focus trap, Escape and backdrop close for free. */
export function FilterSheet({ open, onClose, doneLabel, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={headingId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop around the panel.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 id={headingId} className={styles.heading}>
            סינון
          </h2>
          <button type="button" className={styles.close} aria-label="סגירה" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
        <button type="button" className={styles.done} onClick={onClose}>
          {doneLabel}
        </button>
      </div>
    </dialog>
  )
}
