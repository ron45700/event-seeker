import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useHeightVar } from '../lib/hooks'
import { currentHash, hrefFor, signInHref, type Route, type RouteName } from '../lib/router'
import { useSession } from '../lib/session'
import { BrandMark } from './BrandMark'
import { ChevronDownIcon, MoonIcon, StarIcon, SunIcon, TicketIcon } from './icons'
import styles from './NavBar.module.css'
import { SearchField } from './SearchField'
import { useToast } from './Toast'

interface Props {
  route: Route
  /** The events page with the current search and filters. */
  showsLink: string
  query: string
  onQueryChange: (query: string) => void
}

/**
 * Row 1, sticky from tablet width up. Right-to-left, so in DOM order: the actions on the
 * right (account at the edge, then the theme toggle, then "my artists"), the search pill
 * in the centre, the logo on the left. On a phone the search moves to its own sticky bar
 * and "my artists" to the bottom tab bar.
 */
export function NavBar({ route, showsLink, query, onQueryChange }: Props) {
  const { me, ready } = useSession()
  const heightRef = useHeightVar('--topbar-h')
  const onArtists = route.name === 'artists'

  return (
    <header className={styles.topbar} ref={heightRef}>
      <div className={styles.inner}>
        <div className={styles.actions}>
          {me ? (
            <UserMenu email={me.email} showAdmin={me.show_admin} />
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
          <a href={hrefFor('artists')} className={styles.artists} aria-current={onArtists ? 'page' : undefined}>
            <StarIcon filled={onArtists} width={20} height={20} />
            <span className={styles.artistsLabel}>האמנים שלי</span>
          </a>
        </div>

        <div className={styles.search}>
          <SearchField value={query} onChange={onQueryChange} />
        </div>

        <a href={showsLink} className={styles.logo} lang="en" dir="ltr">
          <BrandMark className={styles.mark} />
          <span className={styles.wordmark}>event seeker</span>
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

/** The signed-in control: the first letter of the email, opening a menu with sign-out (and the admin panel, when offered). */
function UserMenu({ email, showAdmin }: { email: string; showAdmin: boolean }) {
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
        <ChevronDownIcon width={18} height={18} />
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          <p className={styles.menuLabel}>נכנסת בתור</p>
          <bdi dir="ltr" className={styles.menuEmail}>
            {email}
          </bdi>
          {showAdmin && (
            <a href={hrefFor('admin')} className={styles.menuAction} onClick={() => setOpen(false)}>
              ניהול
            </a>
          )}
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

const TABS: { route: RouteName; label: string; icon: (active: boolean) => ReactNode }[] = [
  { route: 'shows', label: 'כל האירועים', icon: () => <TicketIcon /> },
  { route: 'artists', label: 'האמנים שלי', icon: (active) => <StarIcon filled={active} /> },
]

/**
 * Bottom tab bar on phones, within thumb reach and above the home indicator. It switches
 * screens; the category is picked in the segmented control on the events screen.
 */
export function TabBar({ route, showsLink }: { route: Route; showsLink: string }) {
  return (
    <nav className={styles.tabbar} aria-label="ניווט ראשי">
      {TABS.map(({ route: target, label, icon }) => {
        const active = route.name === target
        return (
          <a
            key={target}
            href={target === 'shows' ? showsLink : hrefFor(target)}
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
