from datetime import datetime

from app import db
from app.models import Event
from app.pipeline import run_once
from app.sources.base import Source


class FakeSource(Source):
    def __init__(self, name="fake"):
        self.name = name
        self.titles: dict[str, str] = {}
        self.fail = False
        self.when = datetime(2099, 12, 1, 21)

    def fetch_raw(self):
        if self.fail:
            raise RuntimeError("site down")
        return [{"id": k, "title": v} for k, v in self.titles.items()]

    def parse_item(self, item):
        return Event(self.name, item["id"], item["title"], self.when, "בארבי", "תל אביב", "u")


class FakeNotifier:
    def __init__(self):
        self.sent = []
        self.fail = False

    def send(self, email, events):
        if self.fail:
            raise RuntimeError("smtp down")
        self.sent.append((email, [e.title for e in events]))


def setup():
    conn = db.connect(":memory:")
    db.add_subscription(conn, db.add_user(conn, "ron@example.com"), "טונה")
    return conn, FakeSource(), FakeNotifier()


def test_first_sync_is_silent_then_new_shows_alert_once():
    conn, source, notifier = setup()
    source.titles = {"1": "טונה"}
    run_once(conn, [source], notifier)
    assert notifier.sent == []

    source.titles = {"1": "טונה - סולד אאוט", "2": "טונה מופע נוסף", "3": "מישהו אחר", "4": "טונה שוב"}
    run_once(conn, [source], notifier)
    assert notifier.sent == [("ron@example.com", ["טונה מופע נוסף", "טונה שוב"])]

    run_once(conn, [source], notifier)
    assert len(notifier.sent) == 1


def test_failed_send_is_retried():
    conn, source, notifier = setup()
    run_once(conn, [source], notifier)
    source.titles = {"1": "טונה"}
    notifier.fail = True
    run_once(conn, [source], notifier)
    notifier.fail = False
    run_once(conn, [source], notifier)
    assert notifier.sent == [("ron@example.com", ["טונה"])]


def test_failing_source_does_not_stop_others_and_new_source_is_silent():
    conn, source, notifier = setup()
    broken = FakeSource("broken")
    broken.fail = True
    run_once(conn, [broken, source], notifier)
    source.titles = {"1": "טונה"}
    broken.fail = False
    broken.titles = {"9": "טונה"}  # first successful sync of broken: no alert
    run_once(conn, [broken, source], notifier)
    assert notifier.sent == [("ron@example.com", ["טונה"])]


def test_venue_filter():
    conn, source, notifier = setup()
    db.add_subscription(conn, db.add_user(conn, "b@example.com"), "טונה", "רידינג")
    run_once(conn, [source], notifier)
    source.titles = {"1": "טונה"}
    run_once(conn, [source], notifier)
    assert [email for email, _ in notifier.sent] == ["ron@example.com"]


def test_emails_off_keeps_alerts_queued_until_turned_on():
    conn, source, notifier = setup()
    run_once(conn, [source], None)
    source.titles = {"1": "טונה"}
    run_once(conn, [source], None)
    assert notifier.sent == []
    run_once(conn, [source], notifier)
    assert notifier.sent == [("ron@example.com", ["טונה"])]


def test_past_events_are_not_sent():
    conn, source, notifier = setup()
    run_once(conn, [source], None)
    source.titles = {"1": "טונה"}
    run_once(conn, [source], None)
    source.when = datetime(2020, 1, 1, 21)
    run_once(conn, [source], notifier)
    assert notifier.sent == []


def test_paused_user_gets_no_alerts():
    conn, source, notifier = setup()
    db.set_paused(conn, db.get_user(conn, "ron@example.com")["id"], True)
    run_once(conn, [source], notifier)
    source.titles = {"1": "טונה"}
    run_once(conn, [source], notifier)
    assert notifier.sent == []


def test_availability_changes_are_stored_without_a_new_alert_and_image_is_kept():
    conn = db.connect(":memory:")
    event = Event("s", "1", "x", datetime(2099, 1, 1), "v", "c", "u", image_url="img", availability="available", tickets_left=5)
    event_id, is_new = db.upsert_event(conn, event)
    event.availability, event.tickets_left, event.image_url = "sold_out", 0, None
    assert db.upsert_event(conn, event) == (event_id, False)
    stored = db.upcoming_events(conn)[0][1]
    assert (stored.availability, stored.tickets_left, stored.image_url) == ("sold_out", 0, "img")


def test_ended_events_and_their_thumbnails_are_purged(tmp_path, monkeypatch):
    from app import config, thumbs
    from app.pipeline import purge_ended

    monkeypatch.setattr(config, "THUMB_DIR", tmp_path)
    conn = db.connect(":memory:")
    user_id = db.add_user(conn, "ron@example.com")
    now = datetime(2026, 10, 10, 12)
    stored = [
        # (id, starts_at, ends_at, image)
        ("over", datetime(2026, 10, 9, 21), None, "old.png"),
        ("late", datetime(2026, 10, 10, 8), None, "late.png"),  # within the grace period
        ("festival", datetime(2026, 10, 8, 18), datetime(2026, 10, 11, 23), "fest.png"),
        ("shared", datetime(2026, 10, 1, 21), None, "photo.png"),  # same photo as "next"
        ("next", datetime(2026, 11, 1, 21), None, "photo.png"),
    ]
    for external_id, starts, ends, image in stored:
        event_id, _ = db.upsert_event(conn, Event("s", external_id, "x", starts, "v", "c", "u", ends_at=ends, image_url=image))
        thumbs.thumbnail_path(image).write_bytes(b"webp")
        db.queue_notification(conn, user_id, event_id)
    (tmp_path / "stale-width.webp").write_bytes(b"webp")  # e.g. from an earlier THUMB_WIDTH
    conn.commit()

    purge_ended(conn, now)

    left = conn.execute("SELECT external_id FROM events ORDER BY external_id").fetchall()
    assert [row["external_id"] for row in left] == ["festival", "late", "next"]
    assert conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0] == 3  # cascaded
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted(
        thumbs.thumbnail_path(image).name for image in ["late.png", "fest.png", "photo.png"])


def test_a_past_event_still_listed_is_not_reinserted_as_new():
    conn, source, notifier = setup()
    run_once(conn, [source], notifier)
    source.titles = {"1": "טונה"}
    source.when = datetime(2026, 1, 1, 21)  # the site still lists a show that took place
    run_once(conn, [source], notifier, now=datetime(2026, 3, 1))
    assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
    run_once(conn, [source], notifier, now=datetime(2026, 3, 1))
    assert notifier.sent == []


def test_run_once_purges_events_that_ended():
    conn, source, notifier = setup()
    source.titles = {"1": "טונה"}
    run_once(conn, [source], notifier, now=datetime(2099, 11, 1))
    assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 1
    source.titles = {}  # the site dropped the show after it took place
    run_once(conn, [source], notifier, now=datetime(2099, 12, 3))
    assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
