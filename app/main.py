"""Command-line interface.

    python -m app.main run-once                         single run
    python -m app.main serve                            site + hourly run in the background
    python -m app.main subscribe EMAIL ARTIST [--venue] add a subscription (until the UI exists)
    python -m app.main list                             show subscriptions
    python -m app.main inject-fake TITLE [--venue]      add a fake event and run the alert flow
    python -m app.main remove-fake                      delete all fake events
"""
import argparse
import logging
import sys
from datetime import datetime, timedelta

from app import config, db
from app.models import Event
from app.notifier import get_notifier
from app.pipeline import run_once
from app.sources import ALL_SOURCES
from app.sources.base import Source

log = logging.getLogger("event_seeker")


class FakeSource(Source):
    """One made-up event, for testing the alert flow end to end without waiting for a real show."""

    name = "test"

    def __init__(self, title: str, venue: str) -> None:
        self.title, self.venue = title, venue

    def fetch_raw(self) -> list:
        return [None]

    def parse_item(self, item) -> Event:
        return Event(
            source=self.name,
            external_id=datetime.now().strftime("%Y%m%d%H%M%S%f"),
            title=self.title,
            starts_at=(datetime.now() + timedelta(days=30)).replace(hour=21, minute=0, second=0, microsecond=0),
            venue=self.venue,
            city="בדיקה",
            url="https://example.com/",
        )


def main() -> None:
    parser = argparse.ArgumentParser(prog="event_seeker")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("run-once")
    commands.add_parser("serve")
    commands.add_parser("list")
    commands.add_parser("remove-fake")
    fake = commands.add_parser("inject-fake")
    fake.add_argument("title")
    fake.add_argument("--venue", default="מקום בדיקה")
    subscribe = commands.add_parser("subscribe")
    subscribe.add_argument("email")
    subscribe.add_argument("artist")
    subscribe.add_argument("--venue")
    args = parser.parse_args()

    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")  # Hebrew output in the Windows terminal
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    conn = db.connect(config.DB_PATH)

    if args.command == "subscribe":
        db.add_subscription(conn, db.add_user(conn, args.email), args.artist, args.venue)
        print(f"Subscription added: {args.email} -> {args.artist}" + (f" ({args.venue})" if args.venue else ""))
    elif args.command == "list":
        for sub in db.list_subscriptions(conn):
            print(f"{sub['email']}: {sub['artist']}" + (f" ({sub['venue']})" if sub["venue"] else ""))
    elif args.command == "run-once":
        run_once(conn, ALL_SOURCES, get_notifier())
    elif args.command == "inject-fake":
        # mark the source as already synced, otherwise its first event would be a silent baseline
        db.mark_source_synced(conn, FakeSource.name)
        conn.commit()
        run_once(conn, [FakeSource(args.title, args.venue)], get_notifier())
        print(f"Fake event added: {args.title} at {args.venue}. Remove it with: python -m app.main remove-fake")
    elif args.command == "remove-fake":
        removed = conn.execute("DELETE FROM events WHERE source = ?", (FakeSource.name,)).rowcount
        conn.commit()
        print(f"Removed {removed} fake event(s)")
    elif args.command == "serve":
        import uvicorn

        uvicorn.run("app.api:app", host=config.HOST, port=config.PORT)

if __name__ == "__main__":
    main()
