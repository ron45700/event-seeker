"""One run of the system: fetch all sources, detect new events, match subscriptions, send."""
import logging
import sqlite3

from app import db
from app.matching import matches
from app.models import Event
from app.notifier import Notifier
from app.sources.base import Source

log = logging.getLogger(__name__)


def sync_source(conn: sqlite3.Connection, source: Source) -> list[tuple[int, Event]]:
    """Fetch and store one source. Returns the new events to check against subscriptions.

    On a source's first sync all events are stored as a baseline with no alerts,
    otherwise every show already listed on the site would count as new.
    """
    events = source.fetch()
    first_sync = not db.is_source_synced(conn, source.name)
    new_events = []
    for event in events:
        event_id, is_new = db.upsert_event(conn, event)
        if is_new:
            new_events.append((event_id, event))
    db.mark_source_synced(conn, source.name)
    conn.commit()
    log.info(
        "%s: %d events, %d new%s",
        source.name, len(events), len(new_events), " (first sync, no alerts)" if first_sync else "",
    )
    return [] if first_sync else new_events


def run_once(conn: sqlite3.Connection, sources: list[Source], notifier: Notifier | None) -> None:
    new_events: list[tuple[int, Event]] = []
    for source in sources:
        try:
            new_events += sync_source(conn, source)
        except Exception:
            # one failing source does not stop the others
            conn.rollback()
            log.exception("%s: sync failed", source.name)

    if new_events:
        for sub in db.list_subscriptions(conn, active_only=True):
            for event_id, event in new_events:
                if matches(event, sub["artist"], sub["venue"]):
                    db.queue_notification(conn, sub["user_id"], event_id)
        conn.commit()

    # includes alerts that failed or waited in the queue on earlier runs
    pending = db.pending_notifications(conn)
    if notifier is None:
        for (_, email), items in pending.items():
            log.info("%d alert(s) waiting for %s (emails are off)", len(items), email)
        return
    for (user_id, email), items in pending.items():
        try:
            notifier.send(email, [event for _, event in items])
        except Exception:
            log.exception("failed to notify %s, will retry next run", email)
            continue
        db.mark_sent(conn, user_id, [event_id for event_id, _ in items])
        conn.commit()
