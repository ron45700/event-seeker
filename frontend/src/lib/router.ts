import { useMemo, useSyncExternalStore } from 'react'

// Hash routes, because the backend's StaticFiles mount has no fallback to index.html
// for unknown paths: /artists would be a 404, #/artists is not.

export type RouteName = 'shows' | 'artists' | 'signin'

export interface Route {
  name: RouteName
  /** Raw ?category= value. Validate it with categoryFromParam before use. */
  category: string | null
  /** ?follow=<event id>: open the follow sheet for that event. */
  follow: number | null
  /** ?next=<hash>: where the sign-in screen returns to. */
  next: string | null
}

const PATHS: Record<RouteName, string> = {
  shows: '#/',
  artists: '#/artists',
  signin: '#/signin',
}

export function parseHash(hash: string): Route {
  const cut = hash.indexOf('?')
  const path = cut === -1 ? hash : hash.slice(0, cut)
  const params = new URLSearchParams(cut === -1 ? '' : hash.slice(cut + 1))
  const name: RouteName =
    path === PATHS.artists ? 'artists' : path === PATHS.signin ? 'signin' : 'shows'
  const follow = params.get('follow')
  const next = params.get('next')
  return {
    name,
    category: params.get('category'),
    follow: follow && /^\d+$/.test(follow) ? Number(follow) : null,
    // Only in-app hashes, so ?next= cannot send anyone elsewhere.
    next: next && next.startsWith('#/') ? next : null,
  }
}

type Params = Record<string, string | number | null | undefined>

export function hrefFor(name: RouteName, params: Params = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${PATHS[name]}?${query}` : PATHS[name]
}

/** The sign-in screen, returning to `back` (a hash) afterwards. */
export function signInHref(back: string): string {
  return hrefFor('signin', { next: back })
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function currentHash(): string {
  return window.location.hash || PATHS.shows
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash)
  return useMemo(() => parseHash(hash), [hash])
}

export function navigate(href: string) {
  window.location.hash = href
}

/** Like navigate, without adding a history entry (Back skips the old hash). */
export function replaceRoute(href: string) {
  window.location.replace(href)
}
