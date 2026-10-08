import re
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from app.models import Event
from app.sources.base import Source

_CONTENT_ID = re.compile(r"ContentID=(\d+)")
_BACKGROUND = re.compile(r"url\(['\"]?([^'\")]+)")


class Reading3Source(Source):
    """Reading 3. The site serves server-rendered HTML; there is no JSON API."""

    name = "reading3"
    LIST_URL = "https://www.reading3.co.il/he/shows/a/main/"

    def fetch_raw(self) -> list[Tag]:
        return self.parse_html(self.get_text(self.LIST_URL))

    @staticmethod
    def parse_html(html: str) -> list[Tag]:
        boxes = BeautifulSoup(html, "html.parser").select("div.show-box")
        if not boxes:
            # a page with no shows at all almost certainly means the site structure changed
            raise ValueError("reading3: no show boxes found, page structure may have changed")
        return boxes

    def parse_item(self, box: Tag) -> Event | None:
        link = box.select_one("a.buy-ticket-link") or box.select_one("a.order-ticket")
        show_id = _CONTENT_ID.search(link["href"]).group(1)
        date = box.select_one(".show-calander span").get_text(strip=True)
        clock = box.select_one(".show-clock span")
        time = clock.get_text(strip=True) if clock else ""
        wrapper = box.select_one(".show-box-wraper")
        image = _BACKGROUND.search(wrapper.get("style", "")) if wrapper else None
        return Event(
            source=self.name,
            external_id=show_id,
            title=" ".join(box.select_one(".show-title-vert").get_text().split()),
            starts_at=datetime.strptime(f"{date} {time or '00:00'}", "%d/%m/%Y %H:%M"),
            venue="רידינג 3",
            city="תל אביב",
            url=f"https://www.reading3.co.il/he/shows/a/view/?ContentID={show_id}",
            image_url=urljoin(self.LIST_URL, image.group(1)) if image else None,
        )
