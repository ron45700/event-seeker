"""Command-line interface.

    python -m app.main run-once                         single run
    python -m app.main serve                            site + hourly run in the background
    python -m app.main subscribe EMAIL ARTIST [--venue] add a subscription (until the UI exists)
    python -m app.main list                             show subscriptions
"""
import argparse
import logging
import sys

from app import config, db
from app.notifier import get_notifier
from app.pipeline import run_once
from app.sources import ALL_SOURCES

log = logging.getLogger("event_seeker")


def main() -> None:
    parser = argparse.ArgumentParser(prog="event_seeker")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("run-once")
    commands.add_parser("serve")
    commands.add_parser("list")
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
    elif args.command == "serve":
        import uvicorn

        uvicorn.run("app.api:app", host=config.HOST, port=config.PORT)

if __name__ == "__main__":
    main()
