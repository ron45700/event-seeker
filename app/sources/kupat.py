import time
from datetime import datetime

from app.models import Event
from app.sources.base import Source

BASE_URL = "https://www.kupat.co.il"

# Venue page slugs (kupat.co.il/<slug>). Kupat Tel Aviv sells for more venues; only these are tracked.
VENUES = ["menora", "amphi_tel_aviv"]

_EVENT_FIELDS = [
    "Event_ID", "Date_Time", "Feature_Name", "Feature_Category_Name", "Location_Name",
    "Venue_City", "Soldout", "Private", "Min_Price", "Max_Price",
]


def venue_url(slug: str) -> str:
    """The site's own venue query (a Strapi API), narrowed to the fields used here."""
    parts = [f"filters[Slug][$eq]={slug}", "fields[0]=Name"]
    parts += [f"populate[Events][fields][{i}]={name}" for i, name in enumerate(_EVENT_FIELDS)]
    show = "populate[Events][populate][Show]"
    parts += [f"{show}[fields][{i}]={name}" for i, name in enumerate(["Name", "Slug", "Show_Image_Url"])]
    parts += [f"{show}[populate][Artists][fields][{i}]={name}" for i, name in enumerate(["Name", "Slug"])]
    return f"{BASE_URL}/api/venues?" + "&".join(parts)


class KupatSource(Source):
    """Kupat Tel Aviv venues. One JSON request per venue returns every dated event there."""

    name = "kupat"
    PAGE_DELAY = 1.0  # seconds between requests, to stay polite

    def fetch_raw(self) -> list[dict]:
        records: list[dict] = []
        for index, slug in enumerate(VENUES):
            if index:
                time.sleep(self.PAGE_DELAY)
            venues = self.get_json(venue_url(slug), {"Referer": f"{BASE_URL}/{slug}"})["data"]
            if not venues:
                raise ValueError(f"kupat: venue {slug!r} not found, the API may have changed")
            records += [e["attributes"] for e in venues[0]["attributes"]["Events"]["data"]]
        if not records:
            # one venue can be empty between seasons, but both at once means the API changed
            raise ValueError("kupat: no events found for any venue, the API may have changed")
        return records

    def parse_item(self, item: dict) -> Event | None:
        if item.get("Private"):
            return None
        show = ((item.get("Show") or {}).get("data") or {}).get("attributes") or {}
        performers = [a["attributes"] for a in (show.get("Artists") or {}).get("data") or []]
        title = str(item["Feature_Name"]).strip()
        names = [" ".join(str(p.get("Name") or "").split()) for p in performers]
        # the public page of a show lives under its artist's slug, not the show's own
        slug = next((p["Slug"] for p in performers if p.get("Slug")), None) or show.get("Slug")
        low, high = item.get("Min_Price"), item.get("Max_Price")
        price = None if low is None else str(low) if high in (None, low) else f"{low}-{high}"
        return Event(
            source=self.name,
            external_id=str(item["Event_ID"]),
            title=title,
            starts_at=datetime.strptime(item["Date_Time"], "%Y-%m-%d %H:%M:%S"),
            venue=str(item["Location_Name"]).strip(),
            city=str(item.get("Venue_City") or "").strip(),
            url=f"{BASE_URL}/{slug}" if slug else BASE_URL,
            artists=[n for n in names if n and n != title],
            category="standup" if "סטנד" in str(item.get("Feature_Category_Name") or "") else "music",
            price=price,
            image_url=show.get("Show_Image_Url") or None,
            availability="sold_out" if item.get("Soldout") else "available",
        )
