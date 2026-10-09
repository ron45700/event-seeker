import { useSyncExternalStore } from 'react'

// Hash routes, because the backend's StaticFiles mount has no fallback to index.html
// for unknown paths: /artists would be a 404, #/artists is not.

export type Route = 'shows' | 'artists' | 'signin'

const PATHS: Record<Route, string> = {
  shows: '#/',
  artists: '#/artists',
  signin: '#/signin',
}

function currentRoute(): Route {
  const path = window.location.hash.replace(/\?.*$/, '')
  if (path === PATHS.artists) return 'artists'
  if (path === PATHS.signin) return 'signin'
  return 'shows'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute)
}

/** href for a route. `next` tells the sign-in screen where to go afterwards. */
export function hrefFor(route: Route, next?: Route): string {
  return next ? `${PATHS[route]}?next=${next}` : PATHS[route]
}

export function navigate(route: Route, next?: Route) {
  window.location.hash = hrefFor(route, next)
}

/** The route to return to after signing in. */
export function nextRoute(): Route {
  const query = window.location.hash.split('?')[1] ?? ''
  const next = new URLSearchParams(query).get('next')
  return next === 'artists' || next === 'shows' ? next : 'shows'
}
