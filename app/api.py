"""The site API. Exposes what db / matching already do, and runs the fetch loop in the background.

Login is email-only with no password: the site is reachable only over Tailscale.
"""
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import config, db, thumbs
from app.admin import SESSION_SECONDS, AdminAuth, Locked, WrongPassword
from app.alerts import get_alerter
from app.matching import contains_term, matches
from app.notifier import get_notifier
from app.pipeline import run_once
from app.sources import ALL_SOURCES
from app.venues import venue_key

log = logging.getLogger(__name__)

COOKIE = "es_user"
# The admin session cookie: a random token, sent only to the admin routes.
ADMIN_COOKIE = "es_admin"
ADMIN_PATH = "/api/admin"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _scheduler(stop: threading.Event) -> None:
    conn = db.connect(config.DB_PATH)
    while not stop.is_set():
        try:
            run_once(conn, ALL_SOURCES, get_notifier(), get_alerter())
        except Exception:
            log.exception("scheduled run failed")
        stop.wait(config.FETCH_INTERVAL_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Venue names stored before canonical spellings existed, including subscription venues
    conn = db.connect(app.state.db_path)
    try:
        events, subs = db.canonicalize_venues(conn)
        if events or subs:
            log.info("venue names: %d event(s) and %d subscription(s) rewritten", events, subs)
    finally:
        conn.close()
    stop = threading.Event()
    if app.state.run_scheduler:
        threading.Thread(target=_scheduler, args=(stop,), daemon=True).start()
    yield
    stop.set()


app = FastAPI(title="event_seeker", lifespan=lifespan)
app.state.run_scheduler = True
app.state.db_path = config.DB_PATH
app.state.admin = AdminAuth()


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
    # Register the address if it is unknown. Without it an unknown address gets a 404, so a
    # typo is caught by the user (who is asked to confirm) instead of becoming a profile.
    create: bool = False


class SubscriptionBody(BaseModel):
    artist: str
    venues: list[str] = []
    venue: str | None = None  # older single-venue form, used when venues is empty


class MeBody(BaseModel):
    paused: bool | None = None
    theme: Literal["dark", "light"] | None = None


def _show_admin(email: str) -> bool:
    """Whether the UI offers the admin entry to this user. Cosmetic: the panel itself still
    asks for the password."""
    return bool(config.ADMIN_PASSWORD) and (not config.ADMIN_EMAIL or email == config.ADMIN_EMAIL)


def _me(user) -> dict:
    return {
        "email": user["email"],
        "paused": bool(user["paused"]),
        "theme": user["theme"],
        "show_admin": _show_admin(user["email"]),
    }


@app.post("/api/login")
def login(body: LoginBody, response: Response, conn=Depends(get_conn)):
    """Log in, or sign up with create=true. An unknown email without create is a 404
    ("not registered"); there is no verification step, so the user confirms the address."""
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid email")
    if db.get_user(conn, email) is None:
        if not body.create:
            raise HTTPException(404, "not registered")
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
    """Follow an artist at a list of venues; an empty list = any venue.

    One row is stored per venue. Any venue replaces the artist's venue-specific rows; specific
    venues are added to the ones already followed (see db.add_artist_venues). Identical
    subscriptions are not duplicated. Returns the full updated list.
    """
    artist = body.artist.strip()
    if not artist:
        raise HTTPException(422, "artist is required")
    venues = body.venues or ([body.venue] if body.venue else [])
    db.add_artist_venues(conn, user["id"], artist, venues)
    return [_subscription(row) for row in db.list_subscriptions(conn, user["id"])]


@app.delete("/api/subscriptions/{subscription_id}", status_code=204)
def delete_subscription(subscription_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    if not db.delete_subscription(conn, user["id"], subscription_id):
        raise HTTPException(404, "subscription not found")


# Admin. Rights come only from the admin session (ADMIN_COOKIE), never from the user cookie,
# which is just an email and can be forged. With no ADMIN_PASSWORD every admin route is a 404.


def admin_enabled() -> None:
    if not config.ADMIN_PASSWORD:
        raise HTTPException(404, "Not Found")


def require_admin(request: Request, _=Depends(admin_enabled)) -> None:
    if not request.app.state.admin.valid(request.cookies.get(ADMIN_COOKIE, "")):
        raise HTTPException(401, "admin session required")


@app.post(f"{ADMIN_PATH}/login", dependencies=[Depends(admin_enabled)])
async def admin_login(request: Request, response: Response):
    """Body {password}. Starts an admin session. 401 for a wrong password; 429 with
    Retry-After (seconds) while locked out after repeated wrong passwords.

    The body is read by hand so that no error response can echo the password back.
    """
    try:
        body = await request.json()
    except ValueError:
        body = None
    password = body.get("password") if isinstance(body, dict) else None
    if not isinstance(password, str) or not password:
        raise HTTPException(422, "password is required")
    client = request.client.host if request.client else "unknown"
    try:
        token = request.app.state.admin.login(client, password)
    except Locked as exc:
        if exc.started:
            log.warning("admin login failed from %s; locked out for %ds", client, exc.retry_after)
        else:
            log.warning("admin login refused from %s: locked out for %ds more", client, exc.retry_after)
        raise HTTPException(429, "too many attempts", headers={"Retry-After": str(exc.retry_after)})
    except WrongPassword as exc:
        log.warning("admin login failed from %s (%d in a row)", client, exc.failures)
        raise HTTPException(401, "wrong password")
    log.info("admin signed in from %s", client)
    response.set_cookie(
        ADMIN_COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite="lax", path=ADMIN_PATH
    )
    return {"ok": True}


@app.post(f"{ADMIN_PATH}/logout", dependencies=[Depends(admin_enabled)])
def admin_logout(request: Request, response: Response):
    request.app.state.admin.logout(request.cookies.get(ADMIN_COOKIE, ""))
    response.delete_cookie(ADMIN_COOKIE, path=ADMIN_PATH)
    return {"ok": True}


@app.get(f"{ADMIN_PATH}/users", dependencies=[Depends(require_admin)])
def admin_users(conn=Depends(get_conn)):
    """Registered users, newest first, each with its subscriptions. created_at is UTC."""
    users = db.list_users_with_subscriptions(conn)
    for user in users:
        user["created_at"] = _utc(user["created_at"]).isoformat().replace("+00:00", "Z")
    return users


@app.delete(f"{ADMIN_PATH}/users/{{user_id}}", dependencies=[Depends(require_admin)])
def admin_delete_user(user_id: int, request: Request, response: Response, conn=Depends(get_conn)):
    """Delete a user with its subscriptions and alerts. When it is the user signed in on
    this browser, that sign-in is cleared too (signed_out: true)."""
    email = db.delete_user(conn, user_id)
    if email is None:
        raise HTTPException(404, "user not found")
    signed_out = request.cookies.get(COOKIE, "").strip().lower() == email
    if signed_out:
        response.delete_cookie(COOKIE)
    log.info("admin deleted user %s", email)
    return {"email": email, "signed_out": signed_out}


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
    """Venues that have upcoming events, for the filter and the subscription venue picker.

    One entry per venue: names are canonical already (app/venues.py), and names that still
    differ only in punctuation are listed once.
    """
    venues: dict[str, tuple[str, str]] = {}
    for _, event in db.upcoming_events(conn):
        venues.setdefault(venue_key(event.venue), (event.venue, event.city))
    return [{"venue": venue, "city": city} for venue, city in sorted(venues.values())]


def _utc(timestamp: str | None) -> datetime | None:
    """SQLite CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS', UTC) as an aware datetime."""
    return datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc) if timestamp else None


def _sources_health(conn) -> list[dict]:
    """Health of every active source.

    Unhealthy = failed SOURCE_ALERT_AFTER_FAILURES runs in a row, or not attempted for more
    than two fetch intervals (the background run stopped). A source that has not run yet,
    right after the first start, counts as healthy.
    """
    stored = db.source_health(conn)
    synced = {row["source"]: row for row in db.source_status(conn)}
    stale_before = datetime.now(timezone.utc) - timedelta(minutes=2 * config.FETCH_INTERVAL_MINUTES + 5)
    result = []
    for name in (source.name for source in ALL_SOURCES):
        row = stored.get(name)
        failures = row["consecutive_failures"] if row else 0
        problem = None
        if row and failures >= config.SOURCE_ALERT_AFTER_FAILURES:
            problem = row["last_error"]
        elif row and _utc(row["last_attempt_at"]) < stale_before:
            problem = "not attempted recently, the background run may have stopped"
        result.append({
            "source": name,
            "healthy": problem is None,
            "problem": problem,
            "consecutive_failures": failures,
            "last_error": row["last_error"] if row else None,
            "last_attempt_at": row["last_attempt_at"] if row else None,
            "last_success_at": row["last_success_at"] if row else None,
            "last_event_count": row["last_event_count"] if row else None,
            "first_synced_at": synced[name]["first_synced_at"] if name in synced else None,
            "last_synced_at": synced[name]["last_synced_at"] if name in synced else None,
        })
    return result


@app.get("/health")
def health(conn=Depends(get_conn)):
    """Liveness: answers 200 whenever the server and the database work, even if a source is
    broken. For monitoring the sources themselves use /health/sources."""
    sources = _sources_health(conn)
    return {
        "status": "ok" if all(s["healthy"] for s in sources) else "degraded",
        "emails_enabled": config.EMAIL_ENABLED,
        "operator_alerts_enabled": get_alerter() is not None,
        "sources": sources,
    }


@app.get("/health/sources")
def health_sources(response: Response, conn=Depends(get_conn)):
    """503 when any source is unhealthy, so an uptime monitor can watch it by status code."""
    sources = _sources_health(conn)
    broken = [s["source"] for s in sources if not s["healthy"]]
    if broken:
        response.status_code = 503
    return {"status": "degraded" if broken else "ok", "broken": broken, "sources": sources}


@app.get("/health/sources/{name}")
def health_source(name: str, response: Response, conn=Depends(get_conn)):
    """One source: 200 healthy, 503 unhealthy, 404 unknown. For a monitor per venue site."""
    for source in _sources_health(conn):
        if source["source"] == name:
            if not source["healthy"]:
                response.status_code = 503
            return source
    raise HTTPException(404, "unknown source")


if config.WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.WEB_DIR, html=True), name="web")
