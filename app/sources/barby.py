from datetime import datetime

from app.models import Event
from app.sources.base import Source


class BarbySource(Source):
    name = "barby"
    API_URL = "https://barby.co.il/api/shows/find"

    def fetch_raw(self) -> list[dict]:
        return self.get_json(self.API_URL, {"Referer": "https://barby.co.il/"})["returnShow"]["show"]

    def parse_item(self, item: dict) -> Event | None:
        # non-empty showType = an internal site record (e.g. a customer-service entry), not a show
        if str(item.get("showType") or "").strip():
            return None
        show_id = str(item["showId"])
        guests = str(item.get("showGuestsNames") or "").strip()
        image = str(item.get("showImage") or "").strip()
        price = item.get("showPrice")
        availability, tickets_left = self._availability(item)
        return Event(
            source=self.name,
            external_id=show_id,
            title=str(item["showName"]).strip(),
            starts_at=datetime.strptime(
                f"{item['showDate']} {item['showTime']}", "%d/%m/%Y %H:%M"
            ),
            venue="בארבי",
            city="תל אביב",
            url=f"https://barby.co.il/show/{show_id}",
            artists=[guests] if guests else [],
            price=str(price) if price not in (None, "") else None,
            image_url=f"https://images.barby.co.il/Logos/{image}" if image else None,
            availability=availability,
            tickets_left=tickets_left,
        )

    @staticmethod
    def _availability(item: dict) -> tuple[str | None, int | None]:
        """Sold out once tickets sold reach the sale cap (checked against the site)."""
        try:
            sold, cap = int(item["showSold"]), int(item["showSoldMaxBuy"])
        except (KeyError, TypeError, ValueError):
            return None, None
        if cap <= 0:
            return None, None
        left = max(cap - sold, 0)
        return ("sold_out" if left == 0 else "available"), left
