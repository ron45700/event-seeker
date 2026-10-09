import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}

/**
 * A modal on a native <dialog>, so focus trap, Escape and the backdrop come for free.
 * A bottom sheet on a phone, a centred panel from tablet width up.
 */
export function Sheet({ open, onClose, title, children }: Props) {
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
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="סגירה" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** The full-width primary button at the bottom of a sheet. */
export function SheetButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.done} onClick={onClick}>
      {children}
    </button>
  )
}
