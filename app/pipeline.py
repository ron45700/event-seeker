"""One run of the system: fetch all sources, detect new events, match subscriptions, send."""
import logging
import sqlite3
from datetime import datetime, timedelta

from app import config, db, thumbs
from app.alerts import Alerter
from app.matching import matches
from app.models import Event
from app.notifier import Notifier
from app.sources.base import Source

log = logging.getLogger(__name__)

# An event counts as over this long after its end (or its start, when the end is unknown).
# Until then it stays stored, so a show running late is not purged and re-added mid-run.
ENDED_GRACE = timedelta(hours=6)


def sync_source(
    conn: sqlite3.Connection, source: Source, now: datetime | None = None
) -> tuple[list[tuple[int, Event]], int]:
    """Fetch and store one source. Returns the new events to check against subscriptions,
    and how many events the source returned in total.

    On a source's first sync all events are stored as a baseline with no alerts,
    otherwise every show already listed on the site would count as new. An event that is
    already over is never inserted: sites keep listing past shows for a while, and once
    purged such a show would otherwise come back as a new event. A stored one is still
    updated, so a date moved into the past takes its queued alert off the list.
    """
    events = source.fetch()
    first_sync = not db.is_source_synced(conn, source.name)
    cutoff = (now or datetime.now()) - ENDED_GRACE
    new_events = []
    for event in events:
        event_id, is_new = db.upsert_event(conn, event, insert=not db.ended_before(event, cutoff))
        if is_new:
            new_events.append((event_id, event))
    db.mark_source_synced(conn, source.name)
    conn.commit()
    log.info(
        "%s: %d events, %d new%s",
        source.name, len(events), len(new_events), " (first sync, no alerts)" if first_sync else "",
    )
    return ([] if first_sync else new_events), len(events)


def track_health(
    conn: sqlite3.Connection, source: str, error: str | None, event_count: int, alerter: Alerter | None
) -> None:
    """Record the outcome of a source's run and tell the operator when it breaks or recovers.

    One message when the source has failed SOURCE_ALERT_AFTER_FAILURES runs in a row, one when
    it works again. A message that could not be sent is retried on the next run.
    """
    state = db.record_source_result(conn, source, error, event_count)
    conn.commit()
    if alerter is None:
        return
    failures = state["consecutive_failures"]
    if error and failures >= config.SOURCE_ALERT_AFTER_FAILURES and not state["alerted"]:
        text = (
            f"\u26a0\ufe0f event_seeker: source '{source}' is broken\n"
            f"Failed {failures} runs in a row, no shows are coming in from it.\n"
            f"Last success: {state['last_success_at'] or 'never'} UTC\n"
            f"Error: {error}"
        )
        alerted = True
    elif not error and state["alerted"]:
        text = f"\u2705 event_seeker: source '{source}' is working again ({event_count} events)"
        alerted = False
    else:
        return
    try:
        alerter.send(text)
    except Exception:
        log.exception("%s: failed to send operator alert, will retry next run", source)
        return
    db.set_source_alerted(conn, source, alerted)
    conn.commit()


def purge_ended(conn: sqlite3.Connection, now: datetime | None = None) -> None:
    """Delete events that are over (with their queued alerts) and thumbnails nothing uses."""
    removed = db.purge_ended_events(conn, (now or datetime.now()) - ENDED_GRACE)
    pruned = thumbs.prune(db.image_urls(conn))
    if removed or pruned:
        log.info("purged %d ended event(s), %d cached thumbnail(s)", removed, pruned)


def run_once(
    conn: sqlite3.Connection,
    sources: list[Source],
    notifier: Notifier | None,
    alerter: Alerter | None = None,
    now: datetime | None = None,
) -> None:
    now = now or datetime.now()
    new_events: list[tuple[int, Event]] = []
    for source in sources:
        try:
            found, count = sync_source(conn, source, now)
        except Exception as exc:
            # one failing source does not stop the others
            conn.rollback()
            log.exception("%s: sync failed", source.name)
            track_health(conn, source.name, f"{type(exc).__name__}: {exc}"[:300], 0, alerter)
            continue
        new_events += found
        # A site that changed its markup usually parses to nothing instead of raising
        error = None if count else "returned no events"
        if error:
            log.warning("%s: %s", source.name, error)
        track_health(conn, source.name, error, count, alerter)

    try:
        purge_ended(conn, now)
    except Exception:
        # housekeeping only: never let it stop the alerts below
        conn.rollback()
        log.exception("purging ended events failed")

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
