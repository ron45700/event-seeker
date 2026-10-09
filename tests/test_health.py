from fastapi.testclient import TestClient

from app import config, db
from app.api import app
from app.pipeline import run_once
from tests.test_pipeline import FakeSource


class FakeAlerter:
    def __init__(self):
        self.sent = []
        self.fail = False

    def send(self, text):
        if self.fail:
            raise RuntimeError("telegram down")
        self.sent.append(text)


def setup(monkeypatch, after=2):
    monkeypatch.setattr(config, "SOURCE_ALERT_AFTER_FAILURES", after)
    source = FakeSource("venue")
    source.titles = {"1": "x"}
    return db.connect(":memory:"), source, FakeAlerter()


def test_alert_once_after_repeated_failures_then_recovery(monkeypatch):
    conn, source, alerter = setup(monkeypatch)
    run_once(conn, [source], None, alerter)
    source.fail = True
    run_once(conn, [source], None, alerter)
    assert alerter.sent == []  # a single failed run is not reported
    run_once(conn, [source], None, alerter)
    run_once(conn, [source], None, alerter)
    assert len(alerter.sent) == 1
    assert "'venue' is broken" in alerter.sent[0] and "site down" in alerter.sent[0]

    source.fail = False
    run_once(conn, [source], None, alerter)
    run_once(conn, [source], None, alerter)
    assert len(alerter.sent) == 2 and "working again" in alerter.sent[1]


def test_source_returning_no_events_counts_as_failure(monkeypatch):
    conn, source, alerter = setup(monkeypatch)
    run_once(conn, [source], None, alerter)
    source.titles = {}
    run_once(conn, [source], None, alerter)
    run_once(conn, [source], None, alerter)
    assert len(alerter.sent) == 1 and "returned no events" in alerter.sent[0]


def test_failed_alert_is_retried_and_health_is_tracked_without_alerter(monkeypatch):
    conn, source, alerter = setup(monkeypatch, after=1)
    source.fail = True
    run_once(conn, [source], None)  # Telegram not configured: tracked, nothing sent
    assert db.source_health(conn)["venue"]["consecutive_failures"] == 1
    alerter.fail = True
    run_once(conn, [source], None, alerter)
    alerter.fail = False
    run_once(conn, [source], None, alerter)
    assert len(alerter.sent) == 1


def test_health_endpoints(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SOURCE_ALERT_AFTER_FAILURES", 2)
    app.state.run_scheduler = False
    app.state.db_path = tmp_path / "test.db"
    conn = db.connect(app.state.db_path)
    with TestClient(app) as client:
        assert client.get("/health/sources").status_code == 200  # nothing has run yet
        db.record_source_result(conn, "barby", None, 12)
        db.record_source_result(conn, "zappa", "boom")
        conn.commit()
        assert client.get("/health/sources").status_code == 200  # one failure is below the threshold
        db.record_source_result(conn, "zappa", "boom")
        conn.commit()
        body = client.get("/health/sources")
        assert body.status_code == 503 and body.json()["broken"] == ["zappa"]
        assert client.get("/health/sources/zappa").status_code == 503
        assert client.get("/health/sources/barby").json()["last_event_count"] == 12
        assert client.get("/health/sources/nope").status_code == 404
        health = client.get("/health")
        assert health.status_code == 200 and health.json()["status"] == "degraded"

        # a source nobody attempted for a long time means the background run stopped
        conn.execute("UPDATE source_health SET last_attempt_at = '2020-01-01 00:00:00' WHERE source = 'barby'")
        conn.commit()
        assert client.get("/health/sources/barby").status_code == 503
