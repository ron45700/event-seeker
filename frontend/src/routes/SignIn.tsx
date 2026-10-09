import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, isUnreachable } from '../lib/api'
import { navigate, useRoute } from '../lib/router'
import { useSession } from '../lib/session'
import styles from './SignIn.module.css'

// Same shape the server accepts (EMAIL_RE in app/api.py).
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** One email field. A new address is registered on the spot; there is no password. */
export function SignIn() {
  const { me, signIn } = useSession()
  const { next } = useRoute()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (me) navigate(next ?? '#/')
  }, [me, next])

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
      if (err instanceof ApiError && err.status === 422) setError('כתובת האימייל לא תקינה.')
      else if (isUnreachable(err)) setError('אין חיבור לשרת. אפשר לנסות שוב.')
      else setError('הכניסה לא הצליחה. אפשר לנסות שוב.')
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h1 className={styles.heading}>כניסה</h1>
        <p className={styles.lead}>בלי סיסמה. כתובת חדשה נרשמת אוטומטית, ואליה יישלחו ההתראות.</p>
        <label htmlFor="email" className={styles.label}>
          אימייל
        </label>
        <input
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
