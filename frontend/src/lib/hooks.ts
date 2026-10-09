import { useCallback, useEffect, useState } from 'react'
import { api, isAbort, type EventQuery } from './api'
import type { ShowEvent, Venue } from './types'

export type Load<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T }

/**
 * Upcoming shows from /api/events. `key` re-runs the request, e.g. when the signed-in
 * user changes and the `subscribed` flags with it. A null query skips the request.
 */
export function useEvents(query: EventQuery | null, key: string) {
  const [state, setState] = useState<Load<ShowEvent[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const q = query?.q
  const venue = query?.venue
  const mine = query?.mine
  const skip = query === null

  useEffect(() => {
    if (skip) return
    const controller = new AbortController()
    setState({ status: 'loading' })
    api
      .events({ q, venue, mine }, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (!isAbort(error)) setState({ status: 'error', error })
      })
    return () => controller.abort()
  }, [skip, q, venue, mine, key, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, retry }
}

/** Venues with upcoming shows, for the subscription venue picker. Empty on failure. */
export function useVenues(): Venue[] {
  const [venues, setVenues] = useState<Venue[]>([])
  useEffect(() => {
    api.venues().then(setVenues).catch(() => setVenues([]))
  }, [])
  return venues
}

/** A ref callback that keeps a CSS custom property on <html> equal to the element's height. */
export function useHeightVar(name: string) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      const root = document.documentElement
      const observer = new ResizeObserver(() => {
        root.style.setProperty(name, `${element.offsetHeight}px`)
      })
      observer.observe(element)
      return () => {
        observer.disconnect()
        root.style.removeProperty(name)
      }
    },
    [name],
  )
}
