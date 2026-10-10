import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { TrashIcon } from '../components/icons'
import { SearchField } from '../components/SearchField'
import { Sheet } from '../components/Sheet'
import { SkeletonGrid } from '../components/SkeletonGrid'
import { StateMessage } from '../components/StateMessage'
import { useToast } from '../components/Toast'
import { ApiError, api, isUnreachable } from '../lib/api'
import { israelDate } from '../lib/format'
import { hrefFor, navigate } from '../lib/router'
import { normalize } from '../lib/search'
import { useSession } from '../lib/session'
import { groupByArtist } from '../lib/subscriptions'
import type { AdminUser } from '../lib/types'
import styles from './Admin.module.css'
// The password form looks like the sign-in screen.
import formStyles from './SignIn.module.css'

type View =
  | { status: 'loading' }
  | { status: 'disabled' }
  | { status: 'login'; expired: boolean }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; users: AdminUser[] }

const isStatus = (error: unknown, status: number) => error instanceof ApiError && error.status === status

/**
 * The admin panel: registered users, their followed artists, and deleting a user.
 *
 * Access is an admin session the server keeps (an httponly cookie set by the password
 * form), not the signed-in user: the menu entry is only a shortcut. 404 from the server
 * means the feature is off (no ADMIN_PASSWORD), 401 that there is no session.
 */
export function Admin() {
  const [view, setView] = useState<View>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      setView({ status: 'ready', users: await api.adminUsers() })
    } catch (error) {
      if (isStatus(error, 404)) setView({ status: 'disabled' })
      else if (isStatus(error, 401)) setView({ status: 'login', expired: false })
      else setView({ status: 'error', error })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  switch (view.status) {
    case 'loading':
      return (
        <div className={styles.page}>
          <SkeletonGrid count={4} />
        </div>
      )
    case 'disabled':
      return (
        <StateMessage title="אין כאן ניהול" action={{ label: 'לכל האירועים', href: hrefFor('shows') }}>
          ממשק הניהול לא מופעל בשרת הזה.
        </StateMessage>
      )
    case 'error':
      return (
        <StateMessage role="alert" title="הרשימה לא נטענה" action={{ label: 'לנסות שוב', onClick: () => void load() }}>
          {isUnreachable(view.error) ? 'אין חיבור לשרת.' : 'השרת החזיר שגיאה.'}
        </StateMessage>
      )
    case 'login':
      return (
        <PasswordForm
          expired={view.expired}
          onSignedIn={() => void load()}
          onDisabled={() => setView({ status: 'disabled' })}
        />
      )
    case 'ready':
      return (
        <Users
          users={view.users}
          onUsersChange={(users) => setView({ status: 'ready', users })}
          onExpired={() => setView({ status: 'login', expired: true })}
        />
      )
  }
}

function lockoutText(seconds: number | null): string {
  const minutes = Math.max(1, Math.ceil((seconds ?? 300) / 60))
  return `יותר מדי ניסיונות שגויים, והכניסה לניהול ננעלה. אפשר לנסות שוב בעוד ${minutes === 1 ? 'דקה' : `${minutes} דקות`}.`
}

interface PasswordFormProps {
  /** The session ran out while the panel was open. */
  expired: boolean
  onSignedIn: () => void
  onDisabled: () => void
}

function PasswordForm({ expired, onSignedIn, onDisabled }: PasswordFormProps) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    expired ? 'הכניסה לניהול פגה. צריך להזין את הסיסמה שוב.' : null,
  )
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password) {
      setError('צריך להזין את סיסמת הניהול.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.adminLogin(password)
      onSignedIn()
      return
    } catch (err) {
      if (isStatus(err, 404)) return onDisabled()
      if (isStatus(err, 401)) setError('הסיסמה שגויה.')
      else if (isStatus(err, 429)) setError(lockoutText((err as ApiError).retryAfter))
      else if (isUnreachable(err)) setError('אין חיבור לשרת. אפשר לנסות שוב.')
      else setError('הכניסה לא הצליחה. אפשר לנסות שוב.')
    }
    // A failed password is not kept on screen.
    setPassword('')
    setBusy(false)
    inputRef.current?.focus()
  }

  return (
    <div className={formStyles.page}>
      <form className={formStyles.card} onSubmit={submit} noValidate>
        <h1 className={formStyles.heading}>ניהול</h1>
        <p className={formStyles.lead}>
          ניהול המשתמשים הרשומים. הסיסמה מוגדרת בשרת; אחרי חמישה ניסיונות שגויים הכניסה ננעלת לכמה
          דקות.
        </p>
        <label htmlFor="admin-password" className={formStyles.label}>
          סיסמת ניהול
        </label>
        <input
          ref={inputRef}
          id="admin-password"
          className={formStyles.input}
          type="password"
          dir="ltr"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          value={password}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'admin-password-error' : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p id="admin-password-error" className={formStyles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={formStyles.submit} disabled={busy} aria-busy={busy || undefined}>
          כניסה לניהול
        </button>
      </form>
    </div>
  )
}

interface UsersProps {
  users: AdminUser[]
  onUsersChange: (users: AdminUser[]) => void
  onExpired: () => void
}

function userCount(n: number): string {
  return n === 1 ? 'משתמש רשום אחד' : `${n} משתמשים רשומים`
}

function artistCount(n: number): string {
  if (n === 0) return 'לא עוקב אחרי אמנים'
  return n === 1 ? 'עוקב אחרי אמן אחד' : `עוקב אחרי ${n} אמנים`
}

function Users({ users, onUsersChange, onExpired }: UsersProps) {
  const { me, refresh } = useSession()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const needle = normalize(query)
  const shown = useMemo(
    () =>
      needle
        ? users.filter(
            (user) =>
              normalize(user.email).includes(needle) ||
              user.subscriptions.some((sub) => normalize(sub.artist).includes(needle)),
          )
        : users,
    [users, needle],
  )

  async function exit() {
    try {
      await api.adminLogout()
    } catch {
      // The session ends on its own after a few hours; leaving the screen is what matters.
    }
    toast({ message: 'יצאת מהניהול' })
    navigate(hrefFor('shows'))
  }

  function close() {
    if (busy) return
    setPending(null)
    setDeleteError(null)
  }

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setDeleteError(null)
    try {
      const result = await api.adminDeleteUser(pending.id)
      onUsersChange(users.filter((user) => user.id !== pending.id))
      setPending(null)
      if (result.signed_out) {
        await refresh().catch(() => undefined)
        toast({ message: <>המשתמש <bdi dir="ltr">{result.email}</bdi> נמחק, והחשבון יצא מהדפדפן הזה</> })
      } else {
        toast({ message: <>המשתמש <bdi dir="ltr">{result.email}</bdi> נמחק</> })
      }
    } catch (err) {
      if (isStatus(err, 401)) {
        setPending(null)
        onExpired()
      } else if (isStatus(err, 404)) {
        onUsersChange(users.filter((user) => user.id !== pending.id))
        setPending(null)
        toast({ message: 'המשתמש כבר לא קיים' })
      } else {
        setDeleteError(isUnreachable(err) ? 'אין חיבור לשרת. המשתמש לא נמחק.' : 'המחיקה לא הצליחה. אפשר לנסות שוב.')
      }
    } finally {
      setBusy(false)
    }
  }

  const pendingIsMe = pending !== null && pending.email === me?.email

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>ניהול</h1>
          <p className={styles.count}>{userCount(users.length)}</p>
        </div>
        <button type="button" className={styles.secondary} onClick={() => void exit()}>
          יציאה מהניהול
        </button>
      </div>

      {users.length > 0 && (
        <SearchField
          className={styles.search}
          value={query}
          onChange={setQuery}
          placeholder="חיפוש לפי אימייל או אמן"
          label="חיפוש משתמשים"
        />
      )}

      {users.length === 0 && (
        <StateMessage compact title="אין עדיין משתמשים רשומים">
          משתמשים נוספים כאן כשהם נכנסים לאתר בפעם הראשונה ויוצרים פרופיל.
        </StateMessage>
      )}

      {users.length > 0 && shown.length === 0 && (
        <StateMessage compact title="אין משתמש שמתאים לחיפוש">
          החיפוש בודק את כתובות האימייל ואת שמות האמנים שבמעקב.
        </StateMessage>
      )}

      <ul className={styles.list}>
        {shown.map((user) => {
          const artists = groupByArtist(user.subscriptions)
          const isMe = user.email === me?.email
          return (
            <li key={user.id} className={styles.card}>
              <div className={styles.cardHead}>
                <bdi dir="ltr" className={styles.email}>
                  {user.email}
                </bdi>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={`מחיקת המשתמש ${user.email}`}
                  onClick={() => setPending(user)}
                >
                  <TrashIcon width={20} height={20} />
                </button>
              </div>
              <p className={styles.meta}>
                <span>נרשם ב־{israelDate(user.created_at)}</span>
                <span aria-hidden="true">·</span>
                <span>{artistCount(artists.length)}</span>
                {user.paused && <span className={styles.badge}>התראות מושהות</span>}
                {isMe && <span className={`${styles.badge} ${styles.badgeMe}`}>החשבון שלך</span>}
              </p>
              {artists.length > 0 && (
                <ul className={styles.artists} aria-label={`האמנים של ${user.email}`}>
                  {artists.map((group) => (
                    <li key={group.artist} className={styles.artist}>
                      <bdi className={styles.artistName}>{group.artist}</bdi>
                      <span className={styles.artistVenues}>
                        {group.venues.length === 0 ? 'כל המקומות' : <bdi dir="rtl">{group.venues.join(', ')}</bdi>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <Sheet open={pending !== null} onClose={close} title="מחיקת משתמש">
        {pending && (
          <>
            <p className={styles.confirmText}>
              המשתמש יימחק לצמיתות, יחד עם האמנים שהוא עוקב אחריהם וההתראות שממתינות לו. אי אפשר לבטל את
              המחיקה.
            </p>
            <p className={styles.address} dir="ltr">
              {pending.email}
            </p>
            {pendingIsMe && (
              <p className={styles.note}>זה החשבון שמחובר עכשיו בדפדפן הזה. אחרי המחיקה הוא ייצא ממנו.</p>
            )}
            {deleteError && (
              <p className={styles.error} role="alert">
                {deleteError}
              </p>
            )}
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void confirmDelete()}
              >
                מחיקת המשתמש
              </button>
              <button type="button" className={styles.secondary} disabled={busy} onClick={close}>
                ביטול
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}
