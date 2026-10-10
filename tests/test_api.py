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


def test_unknown_email_needs_confirmation_before_a_profile_is_created(client):
    response = client.post("/api/login", json={"email": "typo@example.com"})
    assert (response.status_code, response.json()["detail"]) == (404, "not registered")
    assert "es_user" not in response.cookies
    assert client.get("/api/me").status_code == 401

    created = client.post("/api/login", json={"email": "Typo@Example.com ", "create": True})
    assert created.json()["email"] == "typo@example.com"
    client.post("/api/logout")
    # a known address signs in without create, and create on a known one changes nothing
    assert client.post("/api/login", json={"email": "typo@example.com"}).status_code == 200
    assert client.post("/api/login", json={"email": "typo@example.com", "create": True}).status_code == 200
    assert client.post("/api/login", json={"email": "bad", "create": True}).status_code == 422


def test_login_subscribe_and_delete(client):
    assert client.post("/api/login", json={"email": "Ron@Example.com", "create": True}).json() == {
        "email": "ron@example.com", "paused": False, "theme": "dark"}
    subs = client.post("/api/subscriptions", json={"artist": "טונה", "venue": "בארבי"}).json()
    client.post("/api/subscriptions", json={"artist": "טונה", "venue": "בארבי"})  # duplicate
    assert client.get("/api/subscriptions").json() == [{"id": subs[0]["id"], "artist": "טונה", "venue": "בארבי"}]
    assert client.delete(f"/api/subscriptions/{subs[0]['id']}").status_code == 204
    assert client.delete(f"/api/subscriptions/{subs[0]['id']}").status_code == 404
    assert client.post("/api/subscriptions", json={"artist": "  "}).status_code == 422


def test_users_cannot_delete_each_others_subscriptions(client):
    client.post("/api/login", json={"email": "a@example.com", "create": True})
    sub_id = client.post("/api/subscriptions", json={"artist": "טונה"}).json()[0]["id"]
    client.post("/api/login", json={"email": "b@example.com", "create": True})
    assert client.delete(f"/api/subscriptions/{sub_id}").status_code == 404


def test_events_listing_filters_and_subscribed_flag(client):
    events = client.get("/api/events").json()
    assert [e["title"] for e in events] == ["טונה", "מוניקה סקס"]  # past show excluded
    assert not any(e["subscribed"] for e in events)
    assert [e["title"] for e in client.get("/api/events", params={"q": "מוניקה"}).json()] == ["מוניקה סקס"]
    assert [e["title"] for e in client.get("/api/events", params={"venue": "בארבי"}).json()] == ["טונה"]

    client.post("/api/login", json={"email": "a@example.com", "create": True})
    client.post("/api/subscriptions", json={"artist": "טונה"})
    assert [e["subscribed"] for e in client.get("/api/events").json()] == [True, False]
    assert [e["title"] for e in client.get("/api/events", params={"mine": True}).json()] == ["טונה"]


def test_pause_venues_and_health(client):
    client.post("/api/login", json={"email": "a@example.com", "create": True})
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


def test_theme_is_saved_per_user_without_touching_pause(client):
    client.post("/api/login", json={"email": "a@example.com", "create": True})
    client.patch("/api/me", json={"paused": True})
    assert client.patch("/api/me", json={"theme": "light"}).json() == {
        "email": "a@example.com", "paused": True, "theme": "light"}
    assert client.patch("/api/me", json={"theme": "pink"}).status_code == 422
    client.post("/api/login", json={"email": "b@example.com", "create": True})
    assert client.get("/api/me").json()["theme"] == "dark"


def test_category_filter(client):
    conn = db.connect(app.state.db_path)
    db.upsert_event(conn, Event("s", "su", "ערב סטנדאפ", datetime(2099, 3, 1), "v", "c", "u", category="standup"))
    conn.commit()
    assert [e["title"] for e in client.get("/api/events", params={"category": "standup"}).json()] == ["ערב סטנדאפ"]
    assert "ערב סטנדאפ" not in [e["title"] for e in client.get("/api/events", params={"category": "music"}).json()]
    assert len(client.get("/api/events").json()) == 3


def _venues(subs):
    return sorted((sub["artist"], sub["venue"] or "") for sub in subs)


def test_subscribe_to_several_venues_and_any_venue_replaces_them(client):
    client.post("/api/login", json={"email": "a@example.com", "create": True})
    subs = client.post("/api/subscriptions", json={"artist": " אביתר  בנאי ", "venues": ["בארבי", "רידינג 3"]}).json()
    assert _venues(subs) == [("אביתר בנאי", "בארבי"), ("אביתר בנאי", "רידינג 3")]

    # more venues are added to the ones already followed
    subs = client.post("/api/subscriptions", json={"artist": "אביתר בנאי", "venues": ["זאפה הרצליה", "בארבי"]}).json()
    assert len(subs) == 3

    # any venue replaces the venue-specific rows
    subs = client.post("/api/subscriptions", json={"artist": "אביתר בנאי", "venues": []}).json()
    assert _venues(subs) == [("אביתר בנאי", "")]

    # and a specific venue does not narrow an artist followed everywhere
    subs = client.post("/api/subscriptions", json={"artist": "אביתר בנאי", "venues": ["בארבי"]}).json()
    assert _venues(subs) == [("אביתר בנאי", "")]

    # the older single-venue body still works, and venues are stored canonical
    subs = client.post("/api/subscriptions", json={"artist": "טונה", "venue": "אודיטוריום ספיר-כפר סבא"}).json()
    assert ("טונה", "אודיטוריום ספיר - כפר סבא") in _venues(subs)


def test_venue_spellings_are_listed_once_and_old_subscriptions_are_rewritten(client):
    from app.api import app as api_app

    conn = db.connect(app.state.db_path)
    for i, venue in enumerate(["אודיטוריום ספיר - כפר סבא", "אודיטוריום ספיר-כפר סבא", "בית החייל - תל אביב"]):
        db.upsert_event(conn, Event("s", f"v{i}", "x", datetime(2099, 2, 1), venue, "", "u"))
    user_id = db.add_user(conn, "old@example.com")
    # stored before canonical names existed: raw spellings, including two that are one venue
    for venue in ["בית החייל תל אביב-סילבסטר", "אודיטוריום ספיר-כפר סבא", "אודיטוריום ספיר - כפר סבא"]:
        conn.execute("INSERT INTO subscriptions (user_id, artist, venue) VALUES (?, 'טונה', ?)", (user_id, venue))
    conn.commit()

    with TestClient(api_app) as restarted:  # the rewrite runs on start-up
        names = [v["venue"] for v in restarted.get("/api/venues").json()]
        assert names.count("אודיטוריום ספיר - כפר סבא") == 1
        assert "אודיטוריום ספיר-כפר סבא" not in names
        restarted.post("/api/login", json={"email": "old@example.com"})
        subs = restarted.get("/api/subscriptions").json()
    assert sorted(sub["venue"] for sub in subs) == ["אודיטוריום ספיר - כפר סבא", "בית החייל - תל אביב"]

    # and they still match the events, whose names were rewritten the same way
    from app.matching import matches
    events = {e.venue: e for _, e in db.upcoming_events(conn)}
    assert all(matches(events[sub["venue"]], "x", sub["venue"]) for sub in subs)
