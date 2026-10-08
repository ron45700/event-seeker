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
