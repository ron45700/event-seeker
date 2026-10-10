import { describe, expect, it } from 'vitest'
import { groupByArtist } from './subscriptions'

describe('groupByArtist', () => {
  it('shows one row per artist with all of its venues', () => {
    const groups = groupByArtist([
      { id: 1, artist: 'אביתר בנאי', venue: 'רידינג 3' },
      { id: 2, artist: 'אביתר בנאי', venue: 'בארבי' },
      { id: 3, artist: 'טונה', venue: null },
    ])
    expect(groups).toEqual([
      { artist: 'אביתר בנאי', venues: ['בארבי', 'רידינג 3'], ids: [1, 2] },
      { artist: 'טונה', venues: [], ids: [3] },
    ])
  })

  it('treats an any-venue row as covering the rest', () => {
    const [group] = groupByArtist([
      { id: 1, artist: 'טונה', venue: 'בארבי' },
      { id: 2, artist: 'טונה', venue: null },
    ])
    expect(group).toEqual({ artist: 'טונה', venues: [], ids: [1, 2] })
  })
})
