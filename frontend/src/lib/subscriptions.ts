import type { Subscription } from './types'

/** One followed artist. The server keeps one row per (artist, venue); the list shows one row. */
export interface ArtistGroup {
  artist: string
  /** Venue names; empty means any venue. */
  venues: string[]
  /** The rows behind it, all removed together. */
  ids: number[]
}

/**
 * Subscriptions as one entry per artist, in the server's order (by artist). An any-venue
 * row covers every venue, so it wins over venue-specific rows left from before.
 */
export function groupByArtist(subs: Subscription[]): ArtistGroup[] {
  const groups = new Map<string, ArtistGroup & { anyVenue: boolean }>()
  for (const sub of subs) {
    let group = groups.get(sub.artist)
    if (!group) {
      group = { artist: sub.artist, venues: [], ids: [], anyVenue: false }
      groups.set(sub.artist, group)
    }
    group.ids.push(sub.id)
    if (sub.venue === null) group.anyVenue = true
    else group.venues.push(sub.venue)
  }
  return [...groups.values()].map(({ artist, venues, ids, anyVenue }) => ({
    artist,
    venues: anyVenue ? [] : [...venues].sort((a, b) => a.localeCompare(b, 'he')),
    ids,
  }))
}
