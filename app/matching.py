"""Matching a subscription against an event. Plain text, no AI."""
import re
import unicodedata

from app.models import Event

_PUNCT = re.compile(r"[^\w\s]|_")
_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Lowercase, strip niqqud / accents, turn punctuation into spaces."""
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = _PUNCT.sub(" ", text.lower())
    return _SPACES.sub(" ", text).strip()


def contains_term(text: str, term: str) -> bool:
    """Whether term appears in text as whole words.

    "טונה" does not match "אפרטונה", but does match "וטונה" (the Hebrew conjunction
    prefix vav is allowed at the start of the word).
    """
    term = normalize(term)
    if not term:
        return False
    pattern = rf"(?:^| )ו?{re.escape(term)}(?: |$)"
    return re.search(pattern, normalize(text)) is not None


def matches(event: Event, artist: str, venue: str | None = None) -> bool:
    if not contains_term(event.searchable_text(), artist):
        return False
    if venue and not contains_term(f"{event.venue} {event.city}", venue):
        return False
    return True
