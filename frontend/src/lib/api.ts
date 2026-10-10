import type { AdminUser, Me, ShowEvent, Subscription, Venue } from './types'

/** An API failure. status 0 means the request never reached the server. */
export class ApiError extends Error {
  readonly status: number
  /** Seconds from a Retry-After header (e.g. an admin lockout), when the server sent one. */
  readonly retryAfter: number | null

  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
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
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new ApiError(
      response.status,
      typeof detail === 'string' ? detail : response.statusText,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    )
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

  // Admin. The session lives in an httponly cookie the server sets; the password is only
  // sent here and never kept. 404 means the feature is off, 401 that there is no session.

  /** 401 for a wrong password, 429 (with retryAfter) while locked out. */
  adminLogin: (password: string) =>
    request<{ ok: boolean }>('/api/admin/login', { method: 'POST', body: jsonBody({ password }) }),

  adminLogout: () => request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),

  adminUsers: () => request<AdminUser[]>('/api/admin/users'),

  /** signed_out: it was the user signed in on this browser, now signed out. */
  adminDeleteUser: (id: number) =>
    request<{ email: string; signed_out: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
}
