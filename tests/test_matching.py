from datetime import datetime

from app.matching import contains_term, matches
from app.models import Event


def make(title, artists=(), venue="בארבי", city="תל אביב"):
    return Event("s", "1", title, datetime(2026, 1, 1), venue, city, "u", artists=list(artists))


def test_whole_words_only():
    assert contains_term("טונה - מופע חדש", "טונה")
    assert not contains_term("אפרטונה בהופעה", "טונה")


def test_punctuation_case_and_niqqud_ignored():
    assert contains_term('ג\'ימבו ג\'יי "הופעה"', "ג׳ימבו ג׳יי")
    assert contains_term("TUNA live", "tuna")
    assert contains_term("שָׁלוֹם חנוך", "שלום חנוך")


def test_vav_prefix():
    assert contains_term("חיים רומנו ושמוליק בודגוב", "שמוליק בודגוב")


def test_matches_guests_and_venue():
    event = make("ערב מיוחד", artists=["חיים רומנו ושמוליק בודגוב"])
    assert matches(event, "חיים רומנו")
    assert matches(event, "חיים רומנו", venue="בארבי")
    assert matches(event, "חיים רומנו", venue="תל אביב")
    assert not matches(event, "חיים רומנו", venue="רידינג")
    assert not matches(event, "טונה")


def test_title_that_contains_the_name():
    # a name followed in "My artists" matches longer titles that contain it as whole words
    assert matches(make("אביתר בנאי והלהקה"), "אביתר בנאי")
    assert matches(make("אביתר בנאי - מופע אקוסטי"), "אביתר בנאי")
    assert matches(make("מופע השקה: אביתר בנאי"), "אביתר בנאי")
    assert matches(make("ערב שירים", artists=["אביתר בנאי"]), "אביתר בנאי")
    # but not a different word that starts the same, nor half of the name
    assert not matches(make("אביתר בנאיים"), "אביתר בנאי")
    assert not matches(make("אביתר כהן"), "אביתר בנאי")
