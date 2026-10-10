# event_seeker

Collects shows from several venue sites and emails an alert when a new show appears for an artist you follow.

## Running

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

python -m app.main serve        # site and API on port 8765, with an hourly run in the background
python -m app.main run-once     # single fetch run
python -m app.main subscribe you@example.com "טונה"
python -m app.main subscribe you@example.com "אביתר בנאי" --venue "בארבי"
python -m app.main list         # show subscriptions
python -m pytest                # tests
```

Interactive API docs: `http://localhost:8765/docs`.

The first run of each source stores the existing shows without sending alerts.
Alerts are sent only for shows added after that.

Email is off by default. To turn it on: copy `.env.example` to `.env`, fill in
`SMTP_USER` and `SMTP_PASSWORD` (a Gmail App Password) and set `EMAIL_ENABLED=true`.
While the switch is off, alerts wait in the queue and are sent once it is turned on.
Alerts for shows that already took place are never sent.

## Docker

Every push to `main` runs the tests and publishes an image with the built UI inside
(`.github/workflows/docker.yml`): `ghcr.io/ron45700/event-seeker:latest`, plus a `sha-...` tag
per commit. The home server runs that image from the `homelab` repo
(`stacks/event-seeker/`), so an update there is `docker compose pull && docker compose up -d`.

```
docker build -t event-seeker .
docker run -p 8765:8765 -v ./data:/app/data --env-file .env event-seeker
```

Settings come from environment variables (the same names as in `.env.example`); the database
and the thumbnail cache are in `/app/data`. The image runs in the `Asia/Jerusalem` time zone.

## Monitoring and operator alerts

Every run records, per source, whether it worked. A run that raised an error or returned no
events at all is a failure (a site that changed its markup usually parses to nothing).

| Endpoint | Answers |
|---|---|
| `/health` | 200 while the server and database work. `status` is `ok` or `degraded`, with the details of every source |
| `/health/sources` | 200, or 503 when any source is unhealthy |
| `/health/sources/{name}` | The same for one source (`barby`, `reading3`, `zappa`, `kupat`, `comy`) |

A source is unhealthy after `SOURCE_ALERT_AFTER_FAILURES` failed runs in a row (default 3), or
when it was not attempted for more than two fetch intervals (the background run stopped).
The two `/health/sources` endpoints are meant for an uptime monitor such as Uptime Kuma.

With `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set, the same condition sends one Telegram
message when a source breaks and one when it works again (`app/alerts.py`). Check the setup
with `python -m app.main test-alert`.

## Frontend

The UI source is in `frontend/` (React, TypeScript, Vite). It builds to `web/`, which the
server serves at `/`. Restart `serve` after the first build: `web/` is mounted only if it
exists when the server starts.

```
cd frontend
npm install
npm run dev      # http://localhost:5173, /api proxied to http://localhost:8765
npm test         # unit tests, including WCAG contrast of both themes (read from tokens.css)
npm run build    # type-check, then write the static build to ../web
```

`API_TARGET=http://host:port npm run dev` points the dev proxy at another backend.
Venue badge colours come from the venue name; fixed hues for known venues are in
`frontend/src/lib/venueColor.ts`. Card image URLs are built in `frontend/src/lib/images.ts`.

Cards load images through `/api/events/{id}/thumbnail`, which downsizes the venue image to a
WebP once and caches it in `data/thumbs/` (safe to delete; `THUMB_WIDTH` sets the size).

Every run deletes events that are over (their end, or their start when there is none, more
than 6 hours ago) and the cached thumbnails no stored event uses any more. A past show that a
site still lists is not stored again, so it never comes back as a new event.

## Layout

| File | Role |
|---|---|
| `app/models.py` | `Event`, the unified format for all sources |
| `app/sources/` | One source per site. `base.py` is the base class, `__init__.py` is the list of active sources |
| `app/db.py` | SQLite: users, subscriptions, events, notifications |
| `app/matching.py` | Matching a subscription against an event |
| `app/venues.py` | One display name per venue, whatever spelling a site uses |
| `app/pipeline.py` | One run: fetch, detect new events, match, send |
| `app/notifier.py` | Sending the alert emails |
| `app/alerts.py` | Operator alerts (Telegram) |
| `app/api.py` | The site API and the scheduled background run |
| `app/main.py` | Command line |
| `docs/UI_BRIEF.md` | Brief for building the UI, including the API contract |
| `web/` | Built UI files, served at `/` |

## Sources

| Source | Venues | How | Availability |
|---|---|---|---|
| `barby` | Barby | JSON API | sold out + tickets left |
| `reading3` | Reading 3 | HTML listing page | not exposed |
| `zappa` | Zappa Amphi Shuni, Tel Aviv, Herzliya | HTML venue pages with JSON-LD, paginated | available / not available |
| `kupat` | Menora Mivtachim Arena, Amphi Tel Aviv (Kupat Tel Aviv) | JSON API, one request per venue | sold out / available |
| `comy` | Stand-up shows nationwide (Comy) | JSON search call, one request | sold out / available |

## Adding a source

1. Add a file under `app/sources/` with a class that extends `Source` and implements `fetch_raw` and `parse_item`.
2. Add it to `ALL_SOURCES` in `app/sources/__init__.py`.
3. Add a sample response under `tests/fixtures/` and a test modelled on `tests/test_barby.py`.

Each event carries its own venue and city, so one source can cover several venues.
Venue names are cleaned for every source in `Source.fetch()` (`app/venues.py`): spacing,
separators, occasion notes such as "סילבסטר", and one spelling per venue. When the same hall
still shows up twice in `/api/venues` under different words, add the pair to `_ALIASES` there;
stored events and subscriptions are rewritten on the next start.
For a festival: `kind="festival"`, the lineup in `artists`, and `ends_at` for a multi-day event.
