"""The site API. Exposes what db / matching already do, and runs the fetch loop in the background.

Login is email-only with no password: the site is reachable only over Tailscale.
"""
import logging
import re
import threading
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import config, db, thumbs
from app.matching import contains_term, matches
from app.notifier import get_notifier
from app.pipeline import run_once
from app.sources import ALL_SOURCES

log = logging.getLogger(__name__)

COOKIE = "es_user"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _scheduler(stop: threading.Event) -> None:
    conn = db.connect(config.DB_PATH)
    while not stop.is_set():
        try:
            run_once(conn, ALL_SOURCES, get_notifier())
        except Exception:
            log.exception("scheduled run failed")
        stop.wait(config.FETCH_INTERVAL_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = threading.Event()
    if app.state.run_scheduler:
        threading.Thread(target=_scheduler, args=(stop,), daemon=True).start()
    yield
    stop.set()


app = FastAPI(title="event_seeker", lifespan=lifespan)
app.state.run_scheduler = True
app.state.db_path = config.DB_PATH


def get_conn(request: Request):
    conn = db.connect(request.app.state.db_path)
    try:
        yield conn
    finally:
        conn.close()


def current_user(request: Request, conn=Depends(get_conn)):
    user = db.get_user(conn, request.cookies.get(COOKIE, ""))
    if user is None:
        raise HTTPException(401, "not logged in")
    return user


class LoginBody(BaseModel):
    email: str


class SubscriptionBody(BaseModel):
    artist: str
    venue: str | None = None


class MeBody(BaseModel):
    paused: bool | None = None
    theme: Literal["dark", "light"] | None = None


def _me(user) -> dict:
    return {"email": user["email"], "paused": bool(user["paused"]), "theme": user["theme"]}


@app.post("/api/login")
def login(body: LoginBody, response: Response, conn=Depends(get_conn)):
    """Log in or sign up. An unknown email is registered automatically."""
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid email")
    db.add_user(conn, email)
    response.set_cookie(COOKIE, email, max_age=60 * 60 * 24 * 365, httponly=True, samesite="lax")
    return _me(db.get_user(conn, email))


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return _me(user)


@app.patch("/api/me")
def update_me(body: MeBody, user=Depends(current_user), conn=Depends(get_conn)):
    """Update the user's settings; only the fields sent are changed.

    paused=true pauses alerts for this user only. theme is the UI theme, "dark" or "light".
    """
    if body.paused is not None:
        db.set_paused(conn, user["id"], body.paused)
    if body.theme is not None:
        db.set_theme(conn, user["id"], body.theme)
    return _me(db.get_user(conn, user["email"]))


def _subscription(row) -> dict:
    return {"id": row["id"], "artist": row["artist"], "venue": row["venue"]}


@app.get("/api/subscriptions")
def list_subscriptions(user=Depends(current_user), conn=Depends(get_conn)):
    return [_subscription(row) for row in db.list_subscriptions(conn, user["id"])]


@app.post("/api/subscriptions", status_code=201)
def add_subscription(body: SubscriptionBody, user=Depends(current_user), conn=Depends(get_conn)):
    """Empty venue = any venue. An identical existing subscription is not duplicated."""
    artist = body.artist.strip()
    if not artist:
        raise HTTPException(422, "artist is required")
    db.add_subscription(conn, user["id"], artist, body.venue)
    return [_subscription(row) for row in db.list_subscriptions(conn, user["id"])]


@app.delete("/api/subscriptions/{subscription_id}", status_code=204)
def delete_subscription(subscription_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    if not db.delete_subscription(conn, user["id"], subscription_id):
        raise HTTPException(404, "subscription not found")


@app.get("/api/events")
def list_events(
    request: Request,
    q: str = "",
    venue: str = "",
    category: str = "",
    mine: bool = False,
    conn=Depends(get_conn),
):
    """Upcoming events ordered by date.

    q: free-text search in title and guests. venue: filter by venue or city.
    category: "music" or "standup"; empty = all categories.
    mine: only events matching the logged-in user's subscriptions.
    Each event carries `subscribed`: whether it matches one of that user's subscriptions.
    """
    user = db.get_user(conn, request.cookies.get(COOKIE, ""))
    subs = db.list_subscriptions(conn, user["id"]) if user else []
    result = []
    for event_id, event in db.upcoming_events(conn):
        if q.strip() and not matches(event, q):
            continue
        if category.strip() and event.category != category.strip():
            continue
        if venue.strip() and not contains_term(f"{event.venue} {event.city}", venue):
            continue
        subscribed = any(matches(event, sub["artist"], sub["venue"]) for sub in subs)
        if mine and not subscribed:
            continue
        result.append({
            "id": event_id,
            "source": event.source,
            "kind": event.kind,
            "category": event.category,
            "title": event.title,
            "artists": event.artists,
            "starts_at": event.starts_at.isoformat(),
            "ends_at": event.ends_at.isoformat() if event.ends_at else None,
            "venue": event.venue,
            "city": event.city,
            "url": event.url,
            "price": event.price,
            "image_url": event.image_url,
            "availability": event.availability,
            "tickets_left": event.tickets_left,
            "subscribed": subscribed,
        })
    return result


@app.get("/api/events/{event_id}/thumbnail")
def event_thumbnail(event_id: int, conn=Depends(get_conn)):
    """A small WebP version of the event image, cached on disk.

    Only images of stored events are fetched, so this is not an open proxy.
    If the thumbnail cannot be built, redirects to the original image.
    """
    image_url = db.event_image_url(conn, event_id)
    if not image_url:
        raise HTTPException(404, "event has no image")
    path = thumbs.get_thumbnail(image_url)
    if path is None:
        return RedirectResponse(image_url)
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/venues")
def list_venues(conn=Depends(get_conn)):
    """Venues that have upcoming events, for the filter and the subscription venue picker."""
    venues = {(event.venue, event.city) for _, event in db.upcoming_events(conn)}
    return [{"venue": venue, "city": city} for venue, city in sorted(venues)]


@app.get("/health")
def health(conn=Depends(get_conn)):
    return {
        "status": "ok",
        "emails_enabled": config.EMAIL_ENABLED,
        "sources": [dict(row) for row in db.source_status(conn)],
    }


if config.WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.WEB_DIR, html=True), name="web")
