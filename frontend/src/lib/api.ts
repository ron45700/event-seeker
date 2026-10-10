import type { Me, ShowEvent, Subscription, Venue } from './types'

/** An API failure. status 0 means the request never reached the server. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** True when the server could not be reached, including a dev proxy that lost its backend. */
export function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = init.body ? { 'Content-Type': 'application/json' } : undefined
  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', headers, ...init })
  } catch (error) {
    if (isAbort(error)) throw error
    throw new ApiError(0, 'network error')
  }
  if (!response.ok) {
    const detail: unknown = await response
      .json()
      .then((body) => body?.detail)
      .catch(() => undefined)
    throw new ApiError(response.status, typeof detail === 'string' ? detail : response.statusText)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const jsonBody = (body: unknown) => JSON.stringify(body)

export interface EventQuery {
  q?: string
  venue?: string
  mine?: boolean
}

export const api = {
  /** The signed-in user, or null when signed out. */
  async me(): Promise<Me | null> {
    try {
      return await request<Me>('/api/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },

  /**
   * Signs in a known address. An unknown one fails with status 404 unless `create` is set,
   * so the user can confirm a new address (there is no verification email).
   */
  login: (email: string, create = false) =>
    request<Me>('/api/login', { method: 'POST', body: jsonBody({ email, create }) }),

  logout: () => request<{ ok: boolean }>('/api/logout', { method: 'POST' }),

  /** Changes only the fields sent. */
  updateMe: (changes: Partial<Pick<Me, 'paused' | 'theme'>>) =>
    request<Me>('/api/me', { method: 'PATCH', body: jsonBody(changes) }),

  subscriptions: () => request<Subscription[]>('/api/subscriptions'),

  /**
   * Follows an artist at these venues; an empty list is any venue, and replaces the
   * artist's venue-specific rows. Returns the updated list.
   */
  addSubscription: (artist: string, venues: string[]) =>
    request<Subscription[]>('/api/subscriptions', {
      method: 'POST',
      body: jsonBody({ artist, venues }),
    }),

  deleteSubscription: (id: number) =>
    request<void>(`/api/subscriptions/${id}`, { method: 'DELETE' }),

  events(query: EventQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.venue) params.set('venue', query.venue)
    if (query.mine) params.set('mine', 'true')
    const search = params.toString()
    return request<ShowEvent[]>(`/api/events${search ? `?${search}` : ''}`, { signal })
  },

  venues: () => request<Venue[]>('/api/venues'),
}
