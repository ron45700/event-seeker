import json
from datetime import datetime
from pathlib import Path

import pytest

from app.sources.comy import ComySource

# A real search reply, trimmed to a few shows and without the per-show benefits lists
REPLY = json.loads((Path(__file__).parent / "fixtures" / "comy.json").read_text(encoding="utf-8"))


class FixtureComy(ComySource):
    def post_json(self, url, data, headers=None):
        return REPLY


@pytest.fixture(scope="module")
def events():
    return FixtureComy().fetch()


def find(events, title, starts_at):
    return next(e for e in events if e.title == title and e.starts_at == starts_at)


def test_repeated_records_collapse(events):
    assert len(events) == 7
    assert len({e.external_id for e in events}) == 7
    assert {e.category for e in events} == {"standup"}


def test_field_mapping(events):
    event = find(events, "אסי כהן - שאולי", datetime(2026, 10, 15, 21, 0))
    assert event.venue == "היכל התרבות עפולה"
    assert event.url == "https://tickets.comy.co.il/booking/features/830?prsntId=53713"
    assert event.image_url.endswith("cover_asi_cohen_cred_ohad_romano.gif")
    assert event.availability == "available"


def test_doors_note_is_dropped_from_the_venue(events):
    event = find(events, "שיחות עם הברמן", datetime(2026, 10, 10, 21, 0))
    assert event.venue == "Babu bar - תל אביב"
    assert event.availability == "sold_out"


def test_glued_link_keeps_the_last_url(events):
    event = find(events, "אורי חזקיה", datetime(2026, 11, 12, 21, 30))
    assert event.url == "https://tickets.comy.co.il/booking/features/827?prsntId=55373"


def test_id_is_stable_between_runs(events):
    assert [e.external_id for e in FixtureComy().fetch()] == [e.external_id for e in events]


def test_empty_reply_is_an_error():
    class Empty(ComySource):
        def post_json(self, url, data, headers=None):
            return {"success": True, "data": {"events": []}}

    with pytest.raises(ValueError):
        Empty().fetch()
