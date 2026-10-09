import { api } from '../lib/api'
import { useVenues } from '../lib/hooks'
import type { ShowEvent } from '../lib/types'
import { AddArtistForm } from './AddArtistForm'
import { Sheet } from './Sheet'

interface Props {
  /** The event being followed; null keeps the sheet closed. */
  event: ShowEvent | null
  onClose: () => void
  onFollowed: (artist: string) => void
}

/** "Follow" from a card: the add form, pre-filled with the event title and its venue on offer. */
export function FollowSheet({ event, onClose, onFollowed }: Props) {
  const venues = useVenues()

  return (
    <Sheet open={event !== null} onClose={onClose} title="מעקב אחרי אמן">
      {event && (
        <AddArtistForm
          key={event.id}
          layout="sheet"
          venues={venues}
          initialArtist={event.title}
          suggestedVenue={event.venue}
          submitLabel="הוספה למעקב"
          hint="אימייל נשלח כשמתפרסם אירוע חדש שהשם הזה מופיע בו. כדאי להשאיר רק את שם האמן, בלי תוספות כמו שם המקום או המופע."
          onAdd={async (artist, venue) => {
            await api.addSubscription(artist, venue)
            onFollowed(artist)
          }}
        />
      )}
    </Sheet>
  )
}
