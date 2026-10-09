import json
from datetime import datetime
from pathlib import Path

from app.sources.barby import BarbySource

RAW = json.loads((Path(__file__).parent / "fixtures" / "barby.json").read_text(encoding="utf-8"))


class FixtureBarby(BarbySource):
    def fetch_raw(self):
        return RAW["returnShow"]["show"]


def test_parses_shows_and_skips_non_show_records():
    events = FixtureBarby().fetch()
    assert [e.external_id for e in events] == ["5449", "5436", "5443", "9001"]


def test_field_mapping():
    event = FixtureBarby().fetch()[2]
    assert event.title == "אביתר בנאי והלהקה"
    assert event.starts_at == datetime(2026, 10, 14, 21, 0)
    assert event.url == "https://barby.co.il/show/5443"
    assert event.image_url == "https://images.barby.co.il/Logos/LOGO_5272_1788093358536.jpeg"
    assert (event.venue, event.city, event.price) == ("בארבי", "תל אביב", "145")


def test_guests_become_artists():
    assert FixtureBarby().fetch()[3].artists == ["חיים רומנו ושמוליק בודגוב"]


def test_bad_item_does_not_break_the_source():
    class Broken(BarbySource):
        def fetch_raw(self):
            return [{"showId": "1", "showName": "x", "showDate": "not a date", "showTime": ""},
                    RAW["returnShow"]["show"][0]]

    assert [e.external_id for e in Broken().fetch()] == ["5449"]


def test_availability_from_sold_counts():
    events = {e.external_id: e for e in FixtureBarby().fetch()}
    assert (events["5449"].availability, events["5449"].tickets_left) == ("sold_out", 0)    # 1154 of 1154
    assert (events["5436"].availability, events["5436"].tickets_left) == ("available", 267)  # 733 of 1000
    assert (events["5443"].availability, events["5443"].tickets_left) == ("sold_out", 0)    # 1162 of 1160
