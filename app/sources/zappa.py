import json
import logging
import re
import time
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from app.models import Event
from app.sources.base import Source

log = logging.getLogger(__name__)

# Zappa lists stand-up next to concerts with no category marker, so it is spotted by keyword.
# Lectures and podcasts are not detected and stay under "music".
_STANDUP = re.compile(r"סטנד[\s-]?אפ|stand[\s-]?up", re.IGNORECASE)

BASE_URL = "https://www.zappa-club.co.il"

# (display name, city, listing page). Zappa has more venues; only these are tracked.
VENUES = [
    ("זאפה אמפי שוני", "בנימינה", f"{BASE_URL}/venue/זאפה-אמפי-שוני-25739/"),
    ("זאפה תל אביב", "תל אביב", f"{BASE_URL}/city/תל-אביב-249/venue/זאפה-תל-אביב-מתחם-מידטאון-25734/"),
    ("זאפה הרצליה", "הרצליה", f"{BASE_URL}/city/הרצליה-314/venue/זאפה-הרצליה-25735/"),
]


class ZappaSource(Source):
    """Zappa clubs (an Eventim storefront). Server-rendered venue pages, 10 events per page.

    Each page has the visible listing (id, date, title, availability) plus a hidden JSON-LD
    block for most events, which is where the artwork and performer name come from.
    """

    name = "zappa"
    MAX_PAGES = 15
    PAGE_DELAY = 1.0  # seconds between requests, to stay polite

    def fetch_raw(self) -> list[dict]:
        records: list[dict] = []
        for venue, city, url in VENUES:
            seen: set[str] = set()
            for page in range(1, self.MAX_PAGES + 1):
                if records or page > 1:
                    time.sleep(self.PAGE_DELAY)
                found = self.parse_page(self.get_text(url if page == 1 else f"{url}?pnum={page}"))
                new = [r for r in found if r["id"] not in seen]
                if not new:  # past the last page, or the site ignored pnum and repeated a page
                    break
                seen.update(r["id"] for r in new)
                records += [{**r, "venue": venue, "city": city} for r in new]
        posters = self._home_posters()
        for record in records:
            record["poster"] = posters.get(record["id"])
        if not records:
            # one venue can be empty off season, but all of them at once means the markup changed
            raise ValueError("zappa: no events found on any venue page, page structure may have changed")
        return records

    def _home_posters(self) -> dict[str, str]:
        """Event id -> poster URL from the home page.

        Best effort: the home page shows only part of each venue's events, and a failure here
        just means every card uses the JSON-LD artwork instead.
        """
        try:
            time.sleep(self.PAGE_DELAY)
            return self.parse_home(self.get_text(f"{BASE_URL}/"))
        except Exception:
            log.warning("zappa: could not read posters from the home page", exc_info=True)
            return {}

    @staticmethod
    def parse_home(html: str) -> dict[str, str]:
        posters = {}
        for link in BeautifulSoup(html, "html.parser").select('a[data-qa="teaser-link"][data-teaser-id]'):
            image = link.select_one("img[data-src]")
            if image is not None and "/event/" in link.get("href", ""):
                posters[link["data-teaser-id"]] = urljoin(BASE_URL, image["data-src"])
        return posters

    @staticmethod
    def parse_page(html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        linked: dict[str, dict] = {}
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
            except ValueError:
                continue
            match = re.search(r"-(\d+)/?$", data.get("url", "")) if isinstance(data, dict) else None
            if match and "startDate" in data:
                linked[match.group(1)] = data
        records = []
        for article in soup.select('article[data-qa="event-listing-item"]'):
            holder = article.select_one("[data-event-id]")
            if holder is not None:
                event_id = holder["data-event-id"]
                records.append({"id": event_id, "article": article, "ld": linked.get(event_id)})
        return records

    def parse_item(self, record: dict) -> Event | None:
        article: Tag = record["article"]
        ld: dict = record["ld"] or {}
        event_id = record["id"]

        heading = article.select_one('[data-qa="list-event-main-info"]')
        lines = [" ".join(line.split()) for line in heading.get_text("\n").split("\n")]
        lines = [line for line in lines if line]
        title, artists = lines[0], lines[1:]
        performer = (ld.get("performer") or {}).get("name", "").strip()
        if performer and performer not in title:
            artists.append(performer)

        path = re.search(rf"/event/[^'\"<>\s]*-{event_id}/", str(article))
        url = BASE_URL + path.group(0) if path else ld.get("url") or BASE_URL

        images = ld.get("image") or []
        # Prefer the home page poster: it is portrait and fills a card, while the JSON-LD
        # artwork is a wide banner. The home page lists only part of each venue's events, so
        # the rest fall back to the artwork. (Event pages reject non-browser clients and are
        # never fetched.)
        artwork = next((i for i in images if "artwork" in i), images[0] if images else None)
        image = record.get("poster") or artwork

        return Event(
            source=self.name,
            external_id=event_id,
            title=title,
            # "2026-10-10T21:00:00.000+03:00": already Israel local time, drop the offset
            starts_at=datetime.fromisoformat(article.select_one("time[datetime]")["datetime"][:19]),
            venue=record["venue"],
            city=record["city"],
            url=url,
            artists=artists,
            category="standup" if _STANDUP.search(" ".join(lines)) else "music",
            image_url=image,
            # the site only says available / not available; "not available" is not
            # necessarily sold out (sales may simply have closed)
            availability="unavailable" if article.select_one(".event-not-available") else "available",
        )
