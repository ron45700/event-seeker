import hashlib
import re
from datetime import datetime, timezone

from app.models import Event
from app.sources.base import Source

BASE_URL = "https://comy.co.il"

# The site's own search call. With no filters it returns every dated show of every comedian,
# so the per-comedian pages never need to be fetched.
SEARCH_URL = f"{BASE_URL}/wp-admin/admin-ajax.php?action=comy_search"
SEARCH_FORM = {
    "mainSearchText": "", "dateFrom": "", "dateTo": "", "isToday": "false", "isTomorrow": "false",
    "isWeekend": "false", "subIsNear": "false", "lat": "", "lng": "", "subIsAnywhere": "true",
    "subArea": "", "subCityText": "", "quickSearch": "false",
}

# venue names carry notes such as "- פתיחת דלתות 20:00" (doors open)
_DOORS = re.compile(r"[\s\-–]*פתיחת דלתות.*$")


class ComySource(Source):
    """Comy, a stand-up ticket site covering venues all over the country."""

    name = "comy"

    def fetch_raw(self) -> list[dict]:
        reply = self.post_json(SEARCH_URL, SEARCH_FORM, {"Referer": f"{BASE_URL}/"})
        records = (reply.get("data") or {}).get("events") or []
        if not records:
            raise ValueError("comy: the search returned no shows, the site may have changed")
        unique = {(r["artistName"], r["timestamp"]): r for r in records}  # the list has repeats
        return list(unique.values())

    def parse_item(self, item: dict) -> Event | None:
        title = " ".join(str(item["artistName"]).split())
        timestamp = int(item["timestamp"])
        # Links are typed by hand on the site (some hold two URLs glued together, some point
        # at the home page), so the id is built from comedian + time instead of the ticket id.
        link = "https" + str(item.get("link") or "").rsplit("https", 1)[-1]
        return Event(
            source=self.name,
            external_id=hashlib.sha1(f"{title}|{timestamp}".encode()).hexdigest()[:16],
            title=title,
            # the timestamp is Israel wall-clock time encoded as if it were UTC
            starts_at=datetime.fromtimestamp(timestamp, timezone.utc).replace(tzinfo=None),
            venue=_DOORS.sub("", str(item["placeName"])).strip(),
            city="",  # not exposed; the town is usually part of the venue name
            url=link if link.startswith("https://") else BASE_URL,
            category="standup",
            image_url=item.get("photo") or None,
            availability="sold_out" if item.get("soldOut") else "available",
        )
