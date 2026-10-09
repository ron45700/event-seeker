import type { ReactNode } from 'react'
import { useHeightVar } from '../lib/hooks'
import { hrefFor, type Route } from '../lib/router'
import { useSession } from '../lib/session'
import { StarIcon, TicketIcon } from './icons'
import styles from './NavBar.module.css'

const TABS: { route: Route; label: string; icon: (active: boolean) => ReactNode }[] = [
  { route: 'shows', label: 'כל ההופעות', icon: () => <TicketIcon /> },
  { route: 'artists', label: 'האמנים שלי', icon: (active) => <StarIcon filled={active} /> },
]

/** Top bar: wordmark, tabs from tablet width up, and the account control. */
export function NavBar({ route }: { route: Route }) {
  const { me, ready, signOut } = useSession()
  const heightRef = useHeightVar('--topbar-h')

  return (
    <header className={styles.topbar} ref={heightRef}>
      <div className={styles.inner}>
        <a href={hrefFor('shows')} className={styles.wordmark}>
          הופעות
        </a>

        <nav className={styles.tabs} aria-label="ניווט ראשי">
          {TABS.map((tab) => (
            <a
              key={tab.route}
              href={hrefFor(tab.route)}
              className={styles.tab}
              aria-current={route === tab.route ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <div className={styles.account}>
          {/* The sign-in and My artists screens carry their own sign-in action. */}
          {ready && !me && route === 'shows' && (
            <a href={hrefFor('signin', 'shows')} className={styles.signIn}>
              כניסה
            </a>
          )}
          {me && (
            <>
              <bdi dir="ltr" className={styles.email} title={me.email}>
                {me.email}
              </bdi>
              <button type="button" className={styles.signOut} onClick={() => void signOut()}>
                יציאה
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/** Bottom tab bar on phones, within thumb reach and above the home indicator. */
export function TabBar({ route }: { route: Route }) {
  return (
    <nav className={styles.tabbar} aria-label="ניווט ראשי">
      {TABS.map(({ route: target, label, icon }) => {
        const active = route === target
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
