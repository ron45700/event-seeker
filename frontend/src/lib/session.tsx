import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Me } from './types'

interface Session {
  me: Me | null
  /** False until the first /api/me answer (or failure) arrives. */
  ready: boolean
  signIn(email: string): Promise<void>
  signOut(): Promise<void>
  setPaused(paused: boolean): Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // A failed check leaves the visitor signed out; the shows page works without a user.
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (email: string) => setMe(await api.login(email)), [])
  const signOut = useCallback(async () => {
    await api.logout()
    setMe(null)
  }, [])
  const setPaused = useCallback(async (paused: boolean) => setMe(await api.setPaused(paused)), [])

  const value = useMemo(
    () => ({ me, ready, signIn, signOut, setPaused }),
    [me, ready, signIn, signOut, setPaused],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider')
  return session
}
