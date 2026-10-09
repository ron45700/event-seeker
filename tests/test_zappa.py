from datetime import datetime
from pathlib import Path

import pytest

from app.sources import zappa
from app.sources.zappa import ZappaSource

FIXTURES = Path(__file__).parent / "fixtures"
PAGES = {
    "25739": (FIXTURES / "zappa_shuni.html").read_text(encoding="utf-8"),
    "25734": (FIXTURES / "zappa_tel_aviv.html").read_text(encoding="utf-8"),
    "25735": (FIXTURES / "zappa_herzliya.html").read_text(encoding="utf-8"),
}
HOME = (FIXTURES / "zappa_home.html").read_text(encoding="utf-8")
EMPTY = "<html><body></body></html>"


class FixtureZappa(ZappaSource):
    """Serves the saved first page of each venue; every other listing page is empty."""

    PAGE_DELAY = 0

    def __init__(self):
        self.requests = []

    def get_text(self, url, headers=None):
        self.requests.append(url)
        if url == "https://www.zappa-club.co.il/":
            return HOME
        if "pnum=" in url:
            return EMPTY
        return next(html for venue_id, html in PAGES.items() if f"-{venue_id}/" in url)


@pytest.fixture(scope="module")
def source():
    source = FixtureZappa()
    source.events = source.fetch()
    return source


def by_id(source, event_id):
    return next(e for e in source.events if e.external_id == event_id)


def test_all_three_venues(source):
    assert len(source.events) == 30
    assert len({e.external_id for e in source.events}) == 30
    assert {(e.venue, e.city) for e in source.events} == {
        ("זאפה אמפי שוני", "בנימינה"), ("זאפה תל אביב", "תל אביב"), ("זאפה הרצליה", "הרצליה")}


def test_field_mapping(source):
    event = by_id(source, "21970383")
    assert event.title == "טונה"
    assert event.starts_at == datetime(2026, 10, 17, 21, 0)
    assert event.url == "https://www.zappa-club.co.il/event/טונה-זאפה-אמפי-שוני-21970383/"
    assert event.image_url.endswith("/teaser/evo/1x1/2026/tunastar-poster.jpg")
    assert event.availability == "unavailable"
    assert by_id(source, "22027034").availability == "available"


def test_guests_line_goes_to_artists(source):
    event = by_id(source, "22008547")
    assert event.title == "שלומי שבן והפסנתר"
    assert "אורחים: אסף אמדורסקי וערן צור" in event.artists


def test_home_page_poster_is_preferred_and_artwork_is_the_fallback(source):
    # on the home page, with JSON-LD: the portrait poster wins over the wide artwork
    assert by_id(source, "21970383").image_url.endswith("/tunastar-poster.jpg")
    # on the home page, no JSON-LD
    assert by_id(source, "21935095").image_url == (
        "https://www.zappa-club.co.il/obj/media/IL-eventim/teaser/evo/1x1/2026/danis26-poster.jpg")
    # every event on these first pages is on the home page; the artwork fallback is
    # covered by test_home_page_failure_only_costs_the_posters
    assert all("/teaser/evo/1x1/" in e.image_url for e in source.events)
    assert not [u for u in source.requests if "/event/" in u]  # event pages are never requested


def test_home_page_failure_only_costs_the_posters():
    class NoHome(FixtureZappa):
        def get_text(self, url, headers=None):
            if url == "https://www.zappa-club.co.il/":
                raise RuntimeError("blocked")
            return super().get_text(url, headers)

    events = {e.external_id: e for e in NoHome().fetch()}
    assert len(events) == 30 and events["21935095"].image_url is None
    assert events["21970383"].image_url.endswith("tunastark-artwork.jpg")


def test_pagination_follows_pnum_until_a_page_adds_nothing(monkeypatch):
    monkeypatch.setattr(zappa, "VENUES", [zappa.VENUES[0]])

    class Paged(FixtureZappa):
        def get_text(self, url, headers=None):
            self.requests.append(url)
            if url == "https://www.zappa-club.co.il/":
                return HOME
            if url.endswith("?pnum=2"):
                return PAGES["25734"]
            if url.endswith("?pnum=3"):
                return PAGES["25734"]  # a site that ignores pnum and repeats a page
            return PAGES["25739"]

    source = Paged()
    assert len(source.fetch()) == 20
    assert [u.rsplit("/", 1)[1] for u in source.requests] == ["", "?pnum=2", "?pnum=3", ""]


def test_no_events_anywhere_fails_loudly():
    class Empty(FixtureZappa):
        def get_text(self, url, headers=None):
            return EMPTY

    with pytest.raises(ValueError):
        Empty().fetch()


def test_standup_is_detected_by_title_keyword(source):
    assert by_id(source, "21946129").category == "standup"  # "אסף מור יוסף במופע סטנדאפ"
    assert by_id(source, "21970383").category == "music"
    assert [e.external_id for e in source.events if e.category == "standup"] == ["21946129"]
