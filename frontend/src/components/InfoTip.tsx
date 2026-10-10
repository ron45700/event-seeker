import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../lib/hooks'
import { placeTip, type TipPlacement } from '../lib/placement'
import { InfoIcon } from './icons'
import styles from './InfoTip.module.css'

// "hover" follows the pointer or keyboard focus; "pinned" was opened by a tap or click and
// stays until a tap outside, Escape or a scroll.
type Mode = 'closed' | 'hover' | 'pinned'

/** Time to move the pointer from the button onto the tip before it closes (WCAG 1.4.13). */
const HOVER_GRACE_MS = 150

interface Props {
  /** The button's accessible name, e.g. "מה זה אומר: לא זמין". */
  label: string
  text: string
  className?: string
  /** "poster" (the default) is a disc over a card's image; "inline" sits in running text, e.g. beside a field label. */
  variant?: 'poster' | 'inline'
}

/**
 * An "i" button with a short explanation. On a mouse or trackpad it is a tooltip on hover
 * and keyboard focus; on touch a tap opens it as a popover anchored to the button. It is
 * rendered on <body> with fixed positioning, so no card mask or overflow can clip it, and
 * placed to stay inside the screen.
 */
export function InfoTip({ label, text, className, variant = 'poster' }: Props) {
  const [mode, setMode] = useState<Mode>('closed')
  const [place, setPlace] = useState<TipPlacement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)')
  const tipId = useId()
  const open = mode !== 'closed'

  const cancelClose = () => window.clearTimeout(closeTimer.current)
  const closeHoverSoon = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setMode((m) => (m === 'hover' ? 'closed' : m)), HOVER_GRACE_MS)
  }

  // Measure before paint, then place. The first render is invisible at 0,0.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null)
      return
    }
    const anchor = buttonRef.current?.getBoundingClientRect()
    const tip = tipRef.current?.getBoundingClientRect()
    if (!anchor || !tip) return
    setPlace(
      placeTip(anchor, tip, { width: document.documentElement.clientWidth, height: window.innerHeight }),
    )
  }, [open, text])

  useEffect(() => {
    if (!open) return
    const close = () => setMode('closed')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !tipRef.current?.contains(target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    // A fixed tip would drift away from its button; close instead.
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => cancelClose, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.button} ${className ?? ''}`}
        data-variant={variant}
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={hoverCapable ? undefined : mode === 'pinned'}
        onClick={() => {
          cancelClose()
          setMode((m) => (m === 'pinned' ? 'closed' : 'pinned'))
        }}
        onPointerEnter={(e) => {
          if (!hoverCapable || e.pointerType === 'touch') return
          cancelClose()
          setMode((m) => (m === 'closed' ? 'hover' : m))
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') closeHoverSoon()
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) setMode((m) => (m === 'closed' ? 'hover' : m))
        }}
        onBlur={() => setMode((m) => (m === 'hover' ? 'closed' : m))}
      >
        <InfoIcon width={18} height={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={styles.tip}
            data-side={place?.side}
            style={
              place
                ? ({ top: place.top, left: place.left, '--arrow-left': `${place.arrowLeft}px` } as CSSProperties)
                : { top: 0, left: 0, visibility: 'hidden' }
            }
            onPointerEnter={cancelClose}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'touch') closeHoverSoon()
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  )
}
