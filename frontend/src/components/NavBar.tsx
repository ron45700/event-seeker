import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { categoryFromParam } from '../lib/categories'
import { useHeightVar } from '../lib/hooks'
import { currentHash, hrefFor, signInHref, type Route, type RouteName } from '../lib/router'
import { useSession } from '../lib/session'
import { ChevronDownIcon, MoonIcon, StarIcon, SunIcon, TicketIcon } from './icons'
import styles from './NavBar.module.css'
import { useToast } from './Toast'

const TABS: { route: RouteName; label: string; icon: (active: boolean) => ReactNode }[] = [
  { route: 'shows', label: 'כל האירועים', icon: () => <TicketIcon /> },
  { route: 'artists', label: 'האמנים שלי', icon: (active) => <StarIcon filled={active} /> },
]

/** "All events" is current only on the events screen with no category picked. */
function isCurrent(tab: RouteName, route: Route): boolean {
  if (tab === 'shows') return route.name === 'shows' && categoryFromParam(route.category) === null
  return route.name === tab
}

/**
 * Top bar. Right-to-left, so the start side is on the right: the account control and the
 * theme toggle there, then the tabs and the logo on the left.
 */
export function NavBar({ route }: { route: Route }) {
  const { me, ready } = useSession()
  const heightRef = useHeightVar('--topbar-h')

  return (
    <header className={styles.topbar} ref={heightRef}>
      <div className={styles.inner}>
        <div className={styles.account}>
          {me ? (
            <UserMenu email={me.email} />
          ) : (
            // The sign-in and My artists screens carry their own sign-in action.
            ready &&
            route.name === 'shows' && (
              <a href={signInHref(currentHash())} className={styles.signIn}>
                כניסה
              </a>
            )
          )}
          <ThemeToggle />
        </div>

        <nav className={styles.tabs} aria-label="ניווט ראשי">
          {TABS.map((tab) => (
            <a
              key={tab.route}
              href={hrefFor(tab.route)}
              className={styles.tab}
              aria-current={isCurrent(tab.route, route) ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <a href={hrefFor('shows')} className={styles.logo} lang="en" dir="ltr">
          event seeker
        </a>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useSession()
  const toast = useToast()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={next === 'light' ? 'מעבר לתצוגה בהירה' : 'מעבר לתצוגה כהה'}
      onClick={() => {
        setTheme(next).catch(() => toast({ message: 'ערכת הצבעים לא נשמרה בחשבון. אפשר לנסות שוב.' }))
      }}
    >
      {next === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

/** The signed-in control: the first letter (and, when there is room, the email) opening a menu. */
function UserMenu({ email }: { email: string }) {
  const { signOut } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.userMenu} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.userButton}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`החשבון: ${email}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {email.charAt(0).toUpperCase()}
        </span>
        <bdi dir="ltr" className={styles.email}>
          {email}
        </bdi>
        <ChevronDownIcon width={18} height={18} />
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          <p className={styles.menuLabel}>נכנסת בתור</p>
          <bdi dir="ltr" className={styles.menuEmail}>
            {email}
          </bdi>
          <button
            type="button"
            className={styles.menuAction}
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            יציאה
          </button>
        </div>
      )}
    </div>
  )
}

/** Bottom tab bar on phones, within thumb reach and above the home indicator. */
export function TabBar({ route }: { route: Route }) {
  return (
    <nav className={styles.tabbar} aria-label="ניווט ראשי">
      {TABS.map(({ route: target, label, icon }) => {
        const active = isCurrent(target, route)
        return (
          <a
            key={target}
            href={hrefFor(target)}
            className={styles.tabbarItem}
            aria-current={active ? 'page' : undefined}
          >
            {icon(active)}
            <span>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
