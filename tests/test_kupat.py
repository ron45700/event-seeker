import json
from datetime import datetime
from pathlib import Path

import pytest

from app.sources.kupat import KupatSource, venue_url

# Real API replies, trimmed to a few events and without the Strapi id fields
FIXTURES = Path(__file__).parent / "fixtures"
REPLIES = {
    "menora": json.loads((FIXTURES / "kupat_menora.json").read_text(encoding="utf-8")),
    "amphi_tel_aviv": json.loads((FIXTURES / "kupat_amphi.json").read_text(encoding="utf-8")),
}


class FixtureKupat(KupatSource):
    PAGE_DELAY = 0

    def get_json(self, url, headers=None):
        return next(reply for slug, reply in REPLIES.items() if f"[$eq]={slug}&" in url)


@pytest.fixture(scope="module")
def events():
    return {e.external_id: e for e in FixtureKupat().fetch()}


def test_both_venues(events):
    assert len(events) == 8
    assert {(e.venue, e.city) for e in events.values()} == {
        ("היכל מנורה מבטחים", "תל אביב"), ("אמפי תל אביב", "תל אביב")}


def test_field_mapping(events):
    event = events["55632"]
    assert event.title == "איתי לוי"
    assert event.starts_at == datetime(2026, 10, 29, 20, 45)
    assert event.url == "https://www.kupat.co.il/itay_levi"
    assert event.image_url.startswith("https://media.kupat.co.il/afc85b20")
    assert (event.price, event.availability, event.category) == ("199-399", "available", "music")
    assert events["54961"].price == "229"


def test_link_uses_the_artist_slug_and_artist_name_is_searchable(events):
    event = events["56000"]
    assert event.url == "https://www.kupat.co.il/mor_reveii"
    assert event.artists == ["מור רביעי"]
    assert events["55986"].artists == []  # same as the title once whitespace is cleaned


def test_each_date_of_a_run_is_its_own_event_with_its_own_availability(events):
    assert events["55986"].availability == "sold_out"
    assert events["56087"].availability == "available"


def test_private_events_are_skipped():
    item = dict(REPLIES["menora"]["data"][0]["attributes"]["Events"]["data"][0]["attributes"])
    assert KupatSource().parse_item({**item, "Private": True}) is None


def test_empty_reply_is_an_error():
    class Empty(FixtureKupat):
        def get_json(self, url, headers=None):
            return {"data": [{"attributes": {"Name": "x", "Events": {"data": []}}}]}

    with pytest.raises(ValueError):
        Empty().fetch()


def test_query_targets_one_venue():
    assert venue_url("menora").startswith(
        "https://www.kupat.co.il/api/venues?filters[Slug][$eq]=menora&")
