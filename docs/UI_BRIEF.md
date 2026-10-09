# UI brief for event_seeker

This document is for whoever builds the frontend. The backend is complete and needs no changes.

## The product

A personal site that aggregates live shows from several venues (currently Barby and Reading 3
in Tel Aviv; more venues and festivals will be added). A user signs in with an email, picks
artists to follow, and gets an email when a new show of theirs is listed. It runs on a home
server, reachable only over Tailscale, for one person and a few friends.

## Language

- All code, comments, identifiers and documentation: English.
- All text the user sees in the UI: Hebrew, right-to-left (`dir="rtl"`, `lang="he"`).
- English names (artists, "BOOMBOX") appear inside Hebrew text and must render correctly.

## Design direction

- Image-rich poster cards in a grid, in the style of concert sites and Seerr (Overseerr / Jellyseerr).
- The venue must be obvious from the card itself, without opening it: a prominent venue badge
  on every card, with a consistent colour per venue. Venues will be added over time, so derive
  the colour from the venue name rather than from a fixed list.
- It will sit as a tile in a Homarr dashboard next to Jellyfin and Seerr, so it should feel
  like part of the same family.

## Devices

Must work well from day one on all three, not as an afterthought:

| Device | Viewport (CSS px) | Notes |
|---|---|---|
| Phone | 360 to 430 wide, portrait | Touch only. The primary way friends will open it |
| iPad 11" | 834 x 1194 portrait, 1194 x 834 landscape | Touch only, both orientations |
| Desktop | 1280 and up | Mouse and keyboard |

- Mobile-first layout. The card grid reflows by width (roughly 2 columns on a phone, 3 to 4 on
  the iPad, more on desktop) with no horizontal scrolling.
- Touch targets at least 44 x 44 px. Nothing may depend on hover.
- Respect safe-area insets (notch, home indicator) and set the viewport meta tag.
- Search, venue filter and the "my artists only" toggle must stay reachable on a phone without
  eating the screen (for example a sticky compact bar or a filter sheet).
- Use `loading="lazy"` on card images; phones will be on mobile data over Tailscale.

## Screens

1. **Sign in:** one email field and a button. A new email is registered automatically. No password.
2. **All shows (home):** card grid ordered by date. Free-text search, venue filter, and a
   "my artists only" toggle. Viewable without signing in.
3. **My artists:** the list of subscriptions, add (artist name plus an optional venue from a
   list, default "any venue"), delete, and a "pause alerts" toggle. After adding an artist,
   show their existing shows right away, because emails are sent only for shows added from now on.

## Show card

Available fields: image, title, venue and city, date and time, price (not always), guests
(not always), ticket link. `subscribed: true` marks a show by an artist the user follows and
should be visually highlighted. Tapping the card opens `url` (the venue's site) in a new tab.

Things to handle:
- `image_url` may be `null`, and an image may fail to load. A good-looking fallback is required.
- Images come from different sites with different aspect ratios (Barby: landscape logo,
  Reading 3: poster).
- `price` is a string in shekels without a currency sign, or `null`.
- `kind` is `show` or `festival`. A festival has `artists` (the lineup) and possibly `ends_at`.
- States: no shows match the search, no subscriptions yet, loading, network error.

## API

Full interactive docs at `http://localhost:8765/docs` while the server is running.

| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | Body: `{email}`. Returns `{email, paused, theme}` and sets a cookie |
| POST | `/api/logout` | |
| GET | `/api/me` | `{email, paused, theme}`, or 401 when not signed in |
| PATCH | `/api/me` | Body: `{paused?: bool, theme?: "dark" \| "light"}`. Only the fields sent change |
| GET | `/api/subscriptions` | `[{id, artist, venue}]`. `venue: null` = any venue |
| POST | `/api/subscriptions` | Body: `{artist, venue?}`. Returns the updated list |
| DELETE | `/api/subscriptions/{id}` | 204 |
| GET | `/api/events` | Query: `q`, `venue`, `category`, `mine`. Upcoming events ordered by date |
| GET | `/api/venues` | `[{venue, city}]` for the filter and the subscription venue picker |

Sample event:

```json
{
  "id": 71, "source": "reading3", "kind": "show", "category": "music",
  "title": "מוניקה סקס", "artists": [],
  "starts_at": "2026-11-13T14:00:00", "ends_at": null,
  "venue": "רידינג 3", "city": "תל אביב",
  "url": "https://www.reading3.co.il/he/shows/a/view/?ContentID=4604",
  "price": null,
  "image_url": "https://www.reading3.co.il/Warehouse/content/pics/pic_4604_C.jpg",
  "availability": null, "tickets_left": null,
  "subscribed": false
}
```

`starts_at` is Israel local time with no timezone. Display it as is, without conversion.

### Category

`category` is `"music"` or `"standup"` and drives the category tabs. More categories may be
added, so render tabs from a small label map and ignore unknown values gracefully.
`kind` (`show` / `festival`) is separate: it describes the shape of the event, not its genre.

### Availability

`availability` is refreshed on every hourly run and is one of:

| Value | Meaning | Where it comes from |
|---|---|---|
| `"available"` | Tickets on sale | Barby, Zappa |
| `"sold_out"` | Sold out | Barby (tickets sold reached the cap) |
| `"unavailable"` | The site shows the show as not available, without saying why. It may be sold out, or sales may simply have closed. Label it "לא זמין", not "sold out" | Zappa |
| `null` | Unknown: the site exposes nothing | Reading 3 |

`tickets_left` is a number only where the site exposes counts (Barby), otherwise `null`.
Sold-out and unavailable shows stay in the list; they should look clearly different from
shows you can still buy, without relying on colour alone.

## Technical constraints

- The server serves the `web/` folder at the project root under `/`. The final build must be
  static files there, with an `index.html`. There is no Node server in production.
- Identity is a cookie, so the UI and the API must share one origin. When developing with a
  separate dev server (Vite or similar), proxy `/api` to `http://localhost:8765` instead of using CORS.
- The data set is small (tens to a few hundred shows). There is no pagination; filtering can
  happen client-side or through the `/api/events` query parameters.
- Run the backend with `python -m app.main serve`.
