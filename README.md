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

## Layout

| File | Role |
|---|---|
| `app/models.py` | `Event`, the unified format for all sources |
| `app/sources/` | One source per site. `base.py` is the base class, `__init__.py` is the list of active sources |
| `app/db.py` | SQLite: users, subscriptions, events, notifications |
| `app/matching.py` | Matching a subscription against an event |
| `app/pipeline.py` | One run: fetch, detect new events, match, send |
| `app/notifier.py` | Sending the alert emails |
| `app/api.py` | The site API and the scheduled background run |
| `app/main.py` | Command line |
| `docs/UI_BRIEF.md` | Brief for building the UI, including the API contract |
| `web/` | Built UI files, served at `/` |

## Adding a source

1. Add a file under `app/sources/` with a class that extends `Source` and implements `fetch_raw` and `parse_item`.
2. Add it to `ALL_SOURCES` in `app/sources/__init__.py`.
3. Add a sample response under `tests/fixtures/` and a test modelled on `tests/test_barby.py`.

Each event carries its own venue and city, so one source can cover several venues.
For a festival: `kind="festival"`, the lineup in `artists`, and `ends_at` for a multi-day event.
