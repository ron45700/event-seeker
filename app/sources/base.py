"""Base for every source. A new source = one file with a class that extends Source."""
import logging
from abc import ABC, abstractmethod

import httpx

from app.models import Event

log = logging.getLogger(__name__)

# Some sites (Barby) return 403 to any client that does not identify as a browser
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
}


class Source(ABC):
    name: str  # short unique id, stored in the database

    @abstractmethod
    def fetch_raw(self) -> list:
        """Fetch the raw records from the site (dict from JSON, HTML tag, etc.)."""

    @abstractmethod
    def parse_item(self, item) -> Event | None:
        """Convert one record into an Event. Returns None for a record that is not an event."""

    def fetch(self) -> list[Event]:
        events = []
        for item in self.fetch_raw():
            try:
                event = self.parse_item(item)
            except Exception:
                # one bad record does not take down the whole source
                log.warning("%s: failed to parse item %r", self.name, item, exc_info=True)
                continue
            if event is not None:
                events.append(event)
        return events

    @staticmethod
    def _get(url: str, headers: dict | None = None) -> httpx.Response:
        response = httpx.get(
            url, headers={**DEFAULT_HEADERS, **(headers or {})}, timeout=30, follow_redirects=True
        )
        response.raise_for_status()
        return response

    @classmethod
    def post_json(cls, url: str, data: dict, headers: dict | None = None):
        """POST a form and return the JSON reply (for sites whose listing is a search call)."""
        response = httpx.post(
            url, data=data, headers={**DEFAULT_HEADERS, **(headers or {})}, timeout=60,
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.json()

    @classmethod
    def get_json(cls, url: str, headers: dict | None = None):
        return cls._get(url, headers).json()

    @classmethod
    def get_text(cls, url: str, headers: dict | None = None) -> str:
        return cls._get(url, headers).text
