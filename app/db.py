"""SQLite layer. All database access goes through here."""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from app.models import Event

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


def upsert_event(conn: sqlite3.Connection, event: Event) -> tuple[int, bool]:
    """Save an event. Returns (id, is_new). An existing event is updated with the latest details
    (a known image is kept if the source stops providing one)."""
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
    conn.execute(
        "INSERT OR IGNORE INTO subscriptions (user_id, artist, venue) VALUES (?,?,?)",
        (user_id, artist.strip(), (venue or "").strip() or None),
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


def event_image_url(conn: sqlite3.Connection, event_id: int) -> str | None:
    row = conn.execute("SELECT image_url FROM events WHERE id = ?", (event_id,)).fetchone()
    return row["image_url"] if row else None


def source_status(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT source, first_synced_at, last_synced_at FROM source_state ORDER BY source"
    ).fetchall()


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
