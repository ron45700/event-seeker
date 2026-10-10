from datetime import datetime

from app.matching import contains_term
from app.models import Event
from app.sources.base import Source
from app.venues import canonical_venue, preferred_spellings, unify_venues


def test_separators_spacing_and_quotes():
    assert canonical_venue("אודיטוריום ספיר-כפר סבא") == "אודיטוריום ספיר - כפר סבא"
    assert canonical_venue("אודיטוריום ספיר - כפר סבא") == "אודיטוריום ספיר - כפר סבא"
    assert canonical_venue("היכל התרבות נתניה -דורטמונד") == "היכל התרבות נתניה - דורטמונד"
    assert canonical_venue("אולם מופעים\xa0מטה\xa0אשר  כברי") == "אולם מופעים מטה אשר כברי"
    assert canonical_venue("היכל ע״ש אריק איינשטיין") == 'היכל ע"ש אריק איינשטיין'
    assert canonical_venue("BBB צמח - מתחם כפרי ,צומת צמח") == "BBB צמח - מתחם כפרי, צומת צמח"
    assert canonical_venue("מוזיאון תל-אביב - אולם רקאנטי") == "מוזיאון תל אביב - אולם רקאנטי"
    assert canonical_venue("בארבי") == "בארבי"


def test_occasion_notes_are_dropped():
    assert canonical_venue("תיאטרון חולון-סילבסטר") == "תיאטרון חולון"
    assert canonical_venue("צוותא 2 סילבסטר") == "צוותא 2"
    assert canonical_venue('אקספו ת"א מופע סילבסטר') == 'אקספו ת"א'
    assert canonical_venue('אלומה הוד השרון - טו בא"ב') == "אלומה הוד השרון"
    assert canonical_venue("צוותא - פתיחת דלתות 20:00") == "צוותא"
    assert canonical_venue("ניסן נתיב-ירושלים - פסטיבל הקומדיה") == "ניסן נתיב - ירושלים"


def test_aliases():
    assert canonical_venue("הוט סינמה אושילנד-כפר סבא") == "הוט סינמה כפר סבא - אושילנד"
    assert canonical_venue("הוט סינמה כפר סבא-אושילנד") == "הוט סינמה כפר סבא - אושילנד"
    assert canonical_venue("friends-אולם-מופת-לשעבר-ראשל״צ-סילבסטר") == 'אולם FRIENDS (מופת) ראשל"צ'
    assert canonical_venue('אולם FRIENDS -(מופת) ראשל"צ') == 'אולם FRIENDS (מופת) ראשל"צ'


def test_one_spelling_per_venue_prefers_the_separated_one():
    names = ["בית החייל תל אביב"] * 3 + ["בית החייל - תל אביב"]
    assert set(preferred_spellings(names).values()) == {"בית החייל - תל אביב"}
    # independent of order
    assert preferred_spellings(list(reversed(names))) == preferred_spellings(names)


def test_canonical_names_still_match_what_was_stored_before():
    # subscriptions keep venue text; matching ignores punctuation, so old text still matches
    for raw in ["אודיטוריום ספיר-כפר סבא", "אולם מופעים\xa0מטה\xa0אשר\xa0כברי", "היכל ע״ש אריק איינשטיין"]:
        assert contains_term(canonical_venue(raw), raw)


class Listing(Source):
    name = "listing"

    def __init__(self, venues):
        self.venues = venues

    def fetch_raw(self):
        return self.venues

    def parse_item(self, venue):
        return Event(self.name, venue, "x", datetime(2099, 1, 1), venue, "", "u")


def test_every_source_gets_one_name_per_venue():
    events = Listing(["בית החייל תל אביב-סילבסטר", "בית החייל - תל אביב", "בית ציוני אמריקה-מאירהוף"]).fetch()
    assert [e.venue for e in events] == ["בית החייל - תל אביב", "בית החייל - תל אביב", "בית ציוני אמריקה - מאירהוף"]


def test_unify_venues_in_place():
    events = [Event("s", str(i), "x", datetime(2099, 1, 1), v, "", "u") for i, v in enumerate(["א-ב", "א ב"])]
    unify_venues(events)
    assert {e.venue for e in events} == {"א - ב"}
