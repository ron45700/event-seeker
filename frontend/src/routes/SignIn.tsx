import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, isUnreachable } from '../lib/api'
import { navigate, useRoute } from '../lib/router'
import { useSession } from '../lib/session'
import styles from './SignIn.module.css'

// Same shape the server accepts (EMAIL_RE in app/api.py).
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 422) return 'כתובת האימייל לא תקינה.'
  if (isUnreachable(err)) return 'אין חיבור לשרת. אפשר לנסות שוב.'
  return 'הכניסה לא הצליחה. אפשר לנסות שוב.'
}

/**
 * One email field, no password. A known address signs in at once. There is no
 * verification email, so an unknown address is shown back for confirmation before a
 * profile is created: a typo must not silently become an empty profile.
 */
export function SignIn() {
  const { me, signIn } = useSession()
  const { next } = useRoute()
  const [email, setEmail] = useState('')
  // The unknown address waiting for "create a profile?"
  const [unknown, setUnknown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (me) navigate(next ?? '#/')
  }, [me, next])

  useEffect(() => {
    if (unknown) confirmRef.current?.focus()
  }, [unknown])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL.test(value)) {
      setError('כתובת האימייל לא תקינה.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signIn(value)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setUnknown(value.toLowerCase())
      else setError(errorText(err))
      setBusy(false)
    }
  }

  async function create() {
    if (!unknown) return
    setBusy(true)
    setError(null)
    try {
      await signIn(unknown, true)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  function edit() {
    setUnknown(null)
    setError(null)
    // After the form is back on screen.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  if (unknown) {
    return (
      <div className={styles.page}>
        <section className={styles.card} aria-labelledby="confirm-heading">
          <h1 className={styles.heading}>כניסה</h1>
          <h2 id="confirm-heading" className={styles.question} tabIndex={-1} ref={confirmRef}>
            לא מצאנו את המייל הזה. ליצור פרופיל חדש?
          </h2>
          <p className={styles.address} dir="ltr">
            {unknown}
          </p>
          <p className={styles.lead}>
            ההתראות יישלחו לכתובת הזו בדיוק. אם יש בה טעות, אפשר לתקן אותה לפני שהפרופיל נוצר.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className={styles.submit}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void create()}
          >
            יצירת פרופיל
          </button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={edit}>
            תיקון הכתובת
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h1 className={styles.heading}>כניסה</h1>
        <p className={styles.lead}>
          בלי סיסמה ובלי מייל אימות, ולכן צריך להקליד את הכתובת בדיוק: אליה יישלחו ההתראות.
        </p>
        <label htmlFor="email" className={styles.label}>
          אימייל
        </label>
        <input
          ref={inputRef}
          id="email"
          className={styles.input}
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com"
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'email-error' : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p id="email-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.submit} disabled={busy} aria-busy={busy || undefined}>
          כניסה
        </button>
      </form>
    </div>
  )
}
