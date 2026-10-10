import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { applyTheme, pageTheme, storeTheme } from './theme'
import type { Me, Theme } from './types'

interface Session {
  me: Me | null
  /** False until the first /api/me answer (or failure) arrives. */
  ready: boolean
  /** Rejects with ApiError 404 for an unknown address unless `create` is set. */
  signIn(email: string, create?: boolean): Promise<void>
  signOut(): Promise<void>
  /** Ask the server again who is signed in (e.g. after the admin deleted this user). */
  refresh(): Promise<void>
  setPaused(paused: boolean): Promise<void>
  theme: Theme
  /** Applies at once; saved to the account when signed in, to this browser otherwise. */
  setTheme(theme: Theme): Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  // index.html already put the stored theme on <html> before the first paint.
  const [theme, setThemeState] = useState<Theme>(pageTheme)

  const showTheme = useCallback((next: Theme) => {
    applyTheme(next)
    storeTheme(next)
    setThemeState(next)
  }, [])

  useEffect(() => {
    // A failed check leaves the visitor signed out; the events page works without a user.
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setReady(true))
  }, [])

  // The account's theme wins over this browser's. It is also cached locally, so the next
  // visit paints in it straight away.
  const accountTheme = me?.theme
  useEffect(() => {
    if (accountTheme) showTheme(accountTheme)
  }, [accountTheme, showTheme])

  const signIn = useCallback(async (email: string, create = false) => setMe(await api.login(email, create)), [])
  const signOut = useCallback(async () => {
    await api.logout()
    setMe(null)
  }, [])
  const refresh = useCallback(async () => setMe(await api.me()), [])
  const setPaused = useCallback(async (paused: boolean) => setMe(await api.updateMe({ paused })), [])

  const signedIn = me !== null
  const setTheme = useCallback(
    async (next: Theme) => {
      const previous = pageTheme()
      showTheme(next)
      if (!signedIn) return
      try {
        setMe(await api.updateMe({ theme: next }))
      } catch (error) {
        showTheme(previous)
        throw error
      }
    },
    [signedIn, showTheme],
  )

  const value = useMemo(
    () => ({ me, ready, signIn, signOut, refresh, setPaused, theme, setTheme }),
    [me, ready, signIn, signOut, refresh, setPaused, theme, setTheme],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider')
  return session
}
