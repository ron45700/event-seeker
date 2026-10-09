from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app import db
from app.api import app
from app.models import Event


@pytest.fixture
def client(tmp_path):
    app.state.run_scheduler = False
    app.state.db_path = tmp_path / "test.db"
    conn = db.connect(app.state.db_path)
    for i, (title, venue) in enumerate([("טונה", "בארבי"), ("מוניקה סקס", "רידינג 3")]):
        db.upsert_event(conn, Event("s", str(i), title, datetime(2099, 1, i + 1, 21), venue, "תל אביב", "u"))
    db.upsert_event(conn, Event("s", "old", "טונה", datetime(2020, 1, 1), "בארבי", "תל אביב", "u"))
    conn.commit()
    with TestClient(app) as client:
        yield client


def test_requires_login(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/subscriptions").status_code == 401
    assert client.post("/api/login", json={"email": "nope"}).status_code == 422


def test_login_subscribe_and_delete(client):
    assert client.post("/api/login", json={"email": "Ron@Example.com"}).json() == {
        "email": "ron@example.com", "paused": False}
    subs = client.post("/api/subscriptions", json={"artist": "טונה", "venue": "בארבי"}).json()
    client.post("/api/subscriptions", json={"artist": "טונה", "venue": "בארבי"})  # duplicate
    assert client.get("/api/subscriptions").json() == [{"id": subs[0]["id"], "artist": "טונה", "venue": "בארבי"}]
    assert client.delete(f"/api/subscriptions/{subs[0]['id']}").status_code == 204
    assert client.delete(f"/api/subscriptions/{subs[0]['id']}").status_code == 404
    assert client.post("/api/subscriptions", json={"artist": "  "}).status_code == 422


def test_users_cannot_delete_each_others_subscriptions(client):
    client.post("/api/login", json={"email": "a@example.com"})
    sub_id = client.post("/api/subscriptions", json={"artist": "טונה"}).json()[0]["id"]
    client.post("/api/login", json={"email": "b@example.com"})
    assert client.delete(f"/api/subscriptions/{sub_id}").status_code == 404


def test_events_listing_filters_and_subscribed_flag(client):
    events = client.get("/api/events").json()
    assert [e["title"] for e in events] == ["טונה", "מוניקה סקס"]  # past show excluded
    assert not any(e["subscribed"] for e in events)
    assert [e["title"] for e in client.get("/api/events", params={"q": "מוניקה"}).json()] == ["מוניקה סקס"]
    assert [e["title"] for e in client.get("/api/events", params={"venue": "בארבי"}).json()] == ["טונה"]

    client.post("/api/login", json={"email": "a@example.com"})
    client.post("/api/subscriptions", json={"artist": "טונה"})
    assert [e["subscribed"] for e in client.get("/api/events").json()] == [True, False]
    assert [e["title"] for e in client.get("/api/events", params={"mine": True}).json()] == ["טונה"]


def test_pause_venues_and_health(client):
    client.post("/api/login", json={"email": "a@example.com"})
    assert client.patch("/api/me", json={"paused": True}).json()["paused"] is True
    assert client.get("/api/me").json()["paused"] is True
    assert client.get("/api/venues").json() == [
        {"venue": "בארבי", "city": "תל אביב"}, {"venue": "רידינג 3", "city": "תל אביב"}]
    assert client.get("/health").json()["status"] == "ok"


def _png(width, height):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "red").save(buf, "PNG")
    return buf.getvalue()


def test_thumbnail_is_resized_and_cached(client, tmp_path, monkeypatch):
    import io
    from PIL import Image
    from app import config, thumbs

    monkeypatch.setattr(config, "THUMB_DIR", tmp_path / "thumbs")
    calls = []
    monkeypatch.setattr(thumbs, "fetch_bytes", lambda url: calls.append(url) or _png(1200, 800))
    conn = db.connect(app.state.db_path)
    event_id, _ = db.upsert_event(conn, Event(
        "s", "img", "x", datetime(2099, 5, 1), "v", "c", "u", image_url="https://example.com/a.png"))
    conn.commit()

    response = client.get(f"/api/events/{event_id}/thumbnail")
    assert response.headers["content-type"] == "image/webp"
    assert Image.open(io.BytesIO(response.content)).size == (480, 320)
    client.get(f"/api/events/{event_id}/thumbnail")
    assert calls == ["https://example.com/a.png"]  # second request served from disk


def test_thumbnail_missing_image_and_fallback(client, tmp_path, monkeypatch):
    from app import config, thumbs

    monkeypatch.setattr(config, "THUMB_DIR", tmp_path / "thumbs")
    monkeypatch.setattr(thumbs, "fetch_bytes", lambda url: b"not an image")
    conn = db.connect(app.state.db_path)
    event_id, _ = db.upsert_event(conn, Event(
        "s", "img", "x", datetime(2099, 5, 1), "v", "c", "u", image_url="https://example.com/a.png"))
    no_image_id, _ = db.upsert_event(conn, Event("s", "none", "x", datetime(2099, 5, 1), "v", "c", "u"))
    conn.commit()

    assert client.get(f"/api/events/{no_image_id}/thumbnail").status_code == 404
    assert client.get("/api/events/99999/thumbnail").status_code == 404
    response = client.get(f"/api/events/{event_id}/thumbnail", follow_redirects=False)
    assert (response.status_code, response.headers["location"]) == (307, "https://example.com/a.png")
