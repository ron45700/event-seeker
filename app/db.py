"""SQLite layer. All database access goes through here."""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from app.models import Event
from app.venues import canonical_venue, preferred_spellings, venue_key

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist     TEXT NOT NULL,
    venue      TEXT,                     -- NULL = any venue
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique
    ON subscriptions (user_id, artist, IFNULL(venue, ''));

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY,
    source      TEXT NOT NULL,
    external_id TEXT NOT NULL,
    kind        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'music',
    title       TEXT NOT NULL,
    artists     TEXT NOT NULL,           -- JSON list
    starts_at   TEXT NOT NULL,           -- ISO, Israel local time
    ends_at     TEXT,
    venue       TEXT NOT NULL,
    city        TEXT NOT NULL,
    url         TEXT NOT NULL,
    price       TEXT,
    image_url   TEXT,
    availability TEXT,                   -- available / sold_out / unavailable / NULL = unknown
    tickets_left INTEGER,
    first_seen  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source, external_id)
);

-- A source listed here has completed its first sync, so its new events trigger alerts
CREATE TABLE IF NOT EXISTS source_state (
    source          TEXT PRIMARY KEY,
    first_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per source that was ever attempted, updated on every run (unlike source_state,
-- which only knows successful syncs). A run that raised or returned no events is a failure.
CREATE TABLE IF NOT EXISTS source_health (
    source               TEXT PRIMARY KEY,
    last_attempt_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_success_at      TEXT,
    last_error           TEXT,               -- NULL while healthy
    last_event_count     INTEGER,            -- events returned by the last successful run
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    alerted              INTEGER NOT NULL DEFAULT 0  -- 1 = the operator was told it is broken
);

-- sent_at NULL = waiting to be sent (or sending failed and will be retried next run)
CREATE TABLE IF NOT EXISTS notifications (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sent_at  TEXT,
    PRIMARY KEY (user_id, event_id)
);
"""


# Columns added after the first version. Applied automatically to an existing database
MIGRATIONS = [
    ("users", "paused", "INTEGER NOT NULL DEFAULT 0"),   # per-user alert pause
    ("users", "theme", "TEXT NOT NULL DEFAULT 'dark'"),  # UI theme: dark / light
    ("events", "category", "TEXT NOT NULL DEFAULT 'music'"),
    ("events", "availability", "TEXT"),
    ("events", "tickets_left", "INTEGER"),
    ("source_state", "last_synced_at", "TEXT"),           # last successful sync
]


def connect(path: Path | str) -> sqlite3.Connection:
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    for table, column, definition in MIGRATIONS:
        existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    conn.commit()
    return conn


def row_to_event(row: sqlite3.Row) -> Event:
    return Event(
        source=row["source"],
        external_id=row["external_id"],
        kind=row["kind"],
        category=row["category"],
        title=row["title"],
        artists=json.loads(row["artists"]),
        starts_at=datetime.fromisoformat(row["starts_at"]),
        ends_at=datetime.fromisoformat(row["ends_at"]) if row["ends_at"] else None,
        venue=row["venue"],
        city=row["city"],
        url=row["url"],
        price=row["price"],
        image_url=row["image_url"],
        availability=row["availability"],
        tickets_left=row["tickets_left"],
    )


def upsert_event(conn: sqlite3.Connection, event: Event, insert: bool = True) -> tuple[int | None, bool]:
    """Save an event. Returns (id, is_new). An existing event is updated with the latest details
    (a known image is kept if the source stops providing one). With insert=False an event
    that is not stored yet is left out, and the result is (None, False)."""
    values = (
        event.kind, event.category, event.title, json.dumps(event.artists, ensure_ascii=False),
        event.starts_at.isoformat(), event.ends_at.isoformat() if event.ends_at else None,
        event.venue, event.city, event.url, event.price, event.image_url,
        event.availability, event.tickets_left,
    )
    row = conn.execute(
        "SELECT id FROM events WHERE source = ? AND external_id = ?",
        (event.source, event.external_id),
    ).fetchone()
    if row:
        conn.execute(
            """UPDATE events SET kind=?, category=?, title=?, artists=?, starts_at=?, ends_at=?, venue=?,
               city=?, url=?, price=?, image_url=COALESCE(?, image_url), availability=?,
               tickets_left=?, last_seen=CURRENT_TIMESTAMP WHERE id=?""",
            (*values, row["id"]),
        )
        return row["id"], False
    if not insert:
        return None, False
    cur = conn.execute(
        """INSERT INTO events (source, external_id, kind, category, title, artists, starts_at, ends_at,
           venue, city, url, price, image_url, availability, tickets_left)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (event.source, event.external_id, *values),
    )
    return cur.lastrowid, True


def is_source_synced(conn: sqlite3.Connection, source: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM source_state WHERE source = ?", (source,)
    ).fetchone() is not None


def mark_source_synced(conn: sqlite3.Connection, source: str) -> None:
    conn.execute("INSERT OR IGNORE INTO source_state (source) VALUES (?)", (source,))
    conn.execute(
        "UPDATE source_state SET last_synced_at = CURRENT_TIMESTAMP WHERE source = ?", (source,)
    )


def add_user(conn: sqlite3.Connection, email: str) -> int:
    email = email.strip().lower()
    conn.execute("INSERT OR IGNORE INTO users (email) VALUES (?)", (email,))
    conn.commit()
    return conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]


def add_subscription(
    conn: sqlite3.Connection, user_id: int, artist: str, venue: str | None = None
) -> None:
    add_artist_venues(conn, user_id, artist, [venue] if venue else [])


def add_artist_venues(conn: sqlite3.Connection, user_id: int, artist: str, venues: list[str]) -> None:
    """Follow an artist at the given venues; an empty list means any venue.

    Stored as one row per (artist, venue). Any venue replaces the artist's venue-specific
    rows instead of sitting next to them. Specific venues are added to the ones already
    followed, and change nothing while the artist is followed at any venue (that row
    already covers them, and silently narrowing an alert would lose shows).
    """
    artist = " ".join(artist.split())
    wanted = list(dict.fromkeys(canonical_venue(v) for v in venues if v and v.strip()))
    if not wanted:
        conn.execute(
            "DELETE FROM subscriptions WHERE user_id = ? AND artist = ? AND venue IS NOT NULL",
            (user_id, artist),
        )
        conn.execute(
            "INSERT OR IGNORE INTO subscriptions (user_id, artist, venue) VALUES (?,?,NULL)",
            (user_id, artist),
        )
    elif conn.execute(
        "SELECT 1 FROM subscriptions WHERE user_id = ? AND artist = ? AND venue IS NULL",
        (user_id, artist),
    ).fetchone() is None:
        conn.executemany(
            "INSERT OR IGNORE INTO subscriptions (user_id, artist, venue) VALUES (?,?,?)",
            [(user_id, artist, venue) for venue in wanted],
        )
    conn.commit()


def list_subscriptions(
    conn: sqlite3.Connection, user_id: int | None = None, active_only: bool = False
) -> list[sqlite3.Row]:
    """All subscriptions, or one user's. active_only leaves out users who paused alerts."""
    return conn.execute(
        """SELECT s.id, s.user_id, u.email, s.artist, s.venue
           FROM subscriptions s JOIN users u ON u.id = s.user_id
           WHERE (:user_id IS NULL OR s.user_id = :user_id) AND (:active = 0 OR u.paused = 0)
           ORDER BY u.email, s.artist""",
        {"user_id": user_id, "active": int(active_only)},
    ).fetchall()


def delete_subscription(conn: sqlite3.Connection, user_id: int, subscription_id: int) -> bool:
    cur = conn.execute(
        "DELETE FROM subscriptions WHERE id = ? AND user_id = ?", (subscription_id, user_id)
    )
    conn.commit()
    return cur.rowcount > 0


def get_user(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT id, email, paused, theme FROM users WHERE email = ?", (email.strip().lower(),)
    ).fetchone()


def set_paused(conn: sqlite3.Connection, user_id: int, paused: bool) -> None:
    conn.execute("UPDATE users SET paused = ? WHERE id = ?", (int(paused), user_id))
    conn.commit()


def set_theme(conn: sqlite3.Connection, user_id: int, theme: str) -> None:
    conn.execute("UPDATE users SET theme = ? WHERE id = ?", (theme, user_id))
    conn.commit()


def upcoming_events(conn: sqlite3.Connection) -> list[tuple[int, Event]]:
    rows = conn.execute(
        "SELECT * FROM events WHERE starts_at >= ? ORDER BY starts_at",
        (datetime.now().isoformat(),),
    ).fetchall()
    return [(row["id"], row_to_event(row)) for row in rows]


def ended_before(event: Event, cutoff: datetime) -> bool:
    """Whether the event was over before cutoff: its end when known, otherwise its start."""
    return (event.ends_at or event.starts_at) < cutoff


def purge_ended_events(conn: sqlite3.Connection, cutoff: datetime) -> int:
    """Delete events that were over before cutoff (same rule as ended_before). Their
    notifications go with them (ON DELETE CASCADE). Returns how many were deleted."""
    cur = conn.execute(
        "DELETE FROM events WHERE COALESCE(ends_at, starts_at) < ?", (cutoff.isoformat(),)
    )
    conn.commit()
    return cur.rowcount


def image_urls(conn: sqlite3.Connection) -> set[str]:
    """The image URLs of every stored event, for pruning the thumbnail cache."""
    rows = conn.execute("SELECT DISTINCT image_url FROM events WHERE image_url IS NOT NULL")
    return {row["image_url"] for row in rows}


def canonicalize_venues(conn: sqlite3.Connection) -> tuple[int, int]:
    """Rewrite stored venue names to their canonical spelling (see app/venues.py).

    Events get the same spelling a fresh fetch would give them. A subscription's venue takes
    the spelling of the stored events at that venue, so it keeps matching them and shows
    under the same name in the venue picker; two of a user's subscriptions that turn out to
    be the same venue are merged. Safe to run on every start. Returns (events, subscriptions)
    changed.
    """
    rows = conn.execute("SELECT id, venue FROM events").fetchall()
    cleaned = {row["id"]: canonical_venue(row["venue"]) for row in rows}
    chosen = preferred_spellings(list(cleaned.values()))
    event_updates = [
        (chosen[cleaned[row["id"]]], row["id"])
        for row in rows if chosen[cleaned[row["id"]]] != row["venue"]
    ]
    conn.executemany("UPDATE events SET venue = ? WHERE id = ?", event_updates)

    by_key = {venue_key(name): name for name in chosen.values()}
    changed = 0
    for sub in conn.execute("SELECT id, user_id, artist, venue FROM subscriptions WHERE venue IS NOT NULL").fetchall():
        target = canonical_venue(sub["venue"])
        target = by_key.get(venue_key(target), target)
        if target == sub["venue"]:
            continue
        changed += 1
        taken = conn.execute(
            "SELECT 1 FROM subscriptions WHERE user_id = ? AND artist = ? AND venue = ?",
            (sub["user_id"], sub["artist"], target),
        ).fetchone()
        if taken:
            conn.execute("DELETE FROM subscriptions WHERE id = ?", (sub["id"],))
        else:
            conn.execute("UPDATE subscriptions SET venue = ? WHERE id = ?", (target, sub["id"]))
    conn.commit()
    return len(event_updates), changed


def event_image_url(conn: sqlite3.Connection, event_id: int) -> str | None:
    row = conn.execute("SELECT image_url FROM events WHERE id = ?", (event_id,)).fetchone()
    return row["image_url"] if row else None


def source_status(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT source, first_synced_at, last_synced_at FROM source_state ORDER BY source"
    ).fetchall()


def record_source_result(
    conn: sqlite3.Connection, source: str, error: str | None, event_count: int = 0
) -> sqlite3.Row:
    """Store the outcome of one run of a source and return its updated health row."""
    conn.execute("INSERT OR IGNORE INTO source_health (source) VALUES (?)", (source,))
    if error is None:
        conn.execute(
            """UPDATE source_health SET last_attempt_at = CURRENT_TIMESTAMP,
               last_success_at = CURRENT_TIMESTAMP, last_error = NULL, last_event_count = ?,
               consecutive_failures = 0 WHERE source = ?""",
            (event_count, source),
        )
    else:
        conn.execute(
            """UPDATE source_health SET last_attempt_at = CURRENT_TIMESTAMP, last_error = ?,
               consecutive_failures = consecutive_failures + 1 WHERE source = ?""",
            (error, source),
        )
    return conn.execute("SELECT * FROM source_health WHERE source = ?", (source,)).fetchone()


def set_source_alerted(conn: sqlite3.Connection, source: str, alerted: bool) -> None:
    conn.execute("UPDATE source_health SET alerted = ? WHERE source = ?", (int(alerted), source))


def source_health(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {row["source"]: row for row in conn.execute("SELECT * FROM source_health")}


def queue_notification(conn: sqlite3.Connection, user_id: int, event_id: int) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO notifications (user_id, event_id) VALUES (?,?)",
        (user_id, event_id),
    )


def pending_notifications(conn: sqlite3.Connection) -> dict[tuple[int, str], list[tuple[int, Event]]]:
    """Unsent alerts grouped by user: {(user_id, email): [(event_id, Event)]}.

    An event that already took place is not sent, even if its alert was waiting in the queue.
    """
    rows = conn.execute(
        """SELECT n.user_id, u.email, e.* FROM notifications n
           JOIN users u ON u.id = n.user_id JOIN events e ON e.id = n.event_id
           WHERE n.sent_at IS NULL AND e.starts_at >= ? ORDER BY e.starts_at""",
        (datetime.now().isoformat(),),
    ).fetchall()
    grouped: dict[tuple[int, str], list[tuple[int, Event]]] = {}
    for row in rows:
        grouped.setdefault((row["user_id"], row["email"]), []).append(
            (row["id"], row_to_event(row))
        )
    return grouped


def mark_sent(conn: sqlite3.Connection, user_id: int, event_ids: list[int]) -> None:
    conn.executemany(
        "UPDATE notifications SET sent_at = CURRENT_TIMESTAMP WHERE user_id = ? AND event_id = ?",
        [(user_id, event_id) for event_id in event_ids],
    )
