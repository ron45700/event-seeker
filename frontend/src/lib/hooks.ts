import { useCallback, useEffect, useRef, useState } from 'react'
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
  const silent = useRef(false)
  const q = query?.q
  const venue = query?.venue
  const mine = query?.mine
  const skip = query === null

  useEffect(() => {
    if (skip) return
    const controller = new AbortController()
    // A silent refresh keeps the current list on screen (and the scroll position with it).
    if (!silent.current) setState({ status: 'loading' })
    silent.current = false
    api
      .events({ q, venue, mine }, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (!isAbort(error)) setState({ status: 'error', error })
      })
    return () => controller.abort()
  }, [skip, q, venue, mine, key, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  /** Re-fetch in the background, e.g. after following an artist. */
  const refresh = useCallback(() => {
    silent.current = true
    setAttempt((n) => n + 1)
  }, [])
  return { state, retry, refresh }
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
        // Rounded down: offsetHeight rounds up, which on fractional heights (2x screens)
        // leaves a hairline gap between stacked sticky bars that content shows through.
        root.style.setProperty(name, `${Math.floor(element.getBoundingClientRect().height)}px`)
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
