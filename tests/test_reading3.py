from datetime import datetime
from pathlib import Path

import pytest

from app.sources.reading3 import Reading3Source

HTML = (Path(__file__).parent / "fixtures" / "reading3.html").read_text(encoding="utf-8")


class FixtureReading3(Reading3Source):
    def fetch_raw(self):
        return self.parse_html(HTML)


def test_parses_all_shows():
    events = FixtureReading3().fetch()
    assert len(events) == 16
    assert len({e.external_id for e in events}) == 16


def test_field_mapping():
    event = next(e for e in FixtureReading3().fetch() if e.external_id == "4604")
    assert event.title == "מוניקה סקס"
    assert event.starts_at == datetime(2026, 11, 13, 14, 0)
    assert event.url == "https://www.reading3.co.il/he/shows/a/view/?ContentID=4604"
    assert event.image_url == "https://www.reading3.co.il/Warehouse/content/pics/pic_4604_C.jpg"
    assert (event.venue, event.city) == ("רידינג 3", "תל אביב")


def test_changed_page_structure_fails_loudly():
    with pytest.raises(ValueError):
        Reading3Source.parse_html("<html><body>redesign</body></html>")
