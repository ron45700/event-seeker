"""One display name per real venue.

Sites type venue names by hand, so the same hall arrives as "אודיטוריום ספיר - כפר סבא" and
"אודיטוריום ספיר-כפר סבא", or with the occasion glued on ("בית החייל תל אביב-סילבסטר").
Matching already ignores punctuation (matching.normalize); this module is about display and
grouping: the venue list, the cards, the filters and the venue colours.

Two steps, both applied to every source in Source.fetch():
- canonical_venue() cleans one name: spacing, separators, quote marks, occasion notes, and
  a short alias list for names that differ in more than punctuation.
- unify_venues() picks one spelling for every group of names that normalize the same,
  since punctuation alone cannot be restored from the normalized form.
"""
import re
from collections import Counter

from app.matching import normalize

_SPACES = re.compile(r"\s+")
# Hebrew gershayim / geresh and typographic quotes, as the ASCII marks most names use
_QUOTES = str.maketrans({"״": '"', "“": '"', "”": '"', "׳": "'", "’": "'", "‘": "'"})
_DASH = re.compile(r"\s*[-–—]\s*")
_COMMA = re.compile(r"\s*,\s*")
_TEL_AVIV = re.compile(r"תל[-–]אביב")
_EDGES = " -,–—"

# Occasion notes appended to the venue name: the show is special, the hall is the same
_NOTES = [
    re.compile(r"[\s\-–]*פתיחת דלתות.*$"),
    re.compile(r"[\s\-–]+(?:מופע\s+)?סילבסטר$"),
    re.compile(r'[\s\-–]+ט"?ו\s+בא"?ב$'),
    re.compile(r"[\s\-–]+פסטיבל הקומדיה.*$"),
    re.compile(r"[\s\-–]+מופע מצולם$"),
]

# Names that differ in more than punctuation (word order, a site's URL slug, a missing
# town). Keyed by the cleaned name; the value is the name to show. Checked against the
# listings; extend when a new duplicate turns up in /api/venues.
_ALIASES = {
    "הוט סינמה אושילנד - כפר סבא": "הוט סינמה כפר סבא - אושילנד",
    'friends - אולם - מופת - לשעבר - ראשל"צ': 'אולם FRIENDS (מופת) ראשל"צ',
    'אולם FRIENDS (מופת) ראשל"צ': 'אולם FRIENDS (מופת) ראשל"צ',
    "בית העם ירושלים": "היכל התרבות - בית העם ירושלים",
    "תיאטרון היהלום": "תיאטרון היהלום - רמת גן",
    "בית גבריאל": "בית גבריאל כינרת - עמק הירדן",
}
_ALIAS_BY_KEY = {normalize(name): target for name, target in _ALIASES.items()}


def venue_key(name: str) -> str:
    """Names with the same key are the same venue."""
    return normalize(name)


def canonical_venue(name: str) -> str:
    text = _SPACES.sub(" ", (name or "").translate(_QUOTES)).strip()
    text = _TEL_AVIV.sub("תל אביב", text)
    for _ in range(3):  # a name can carry more than one note
        stripped = text
        for note in _NOTES:
            stripped = note.sub("", stripped)
        if stripped == text:
            break
        text = stripped
    text = _DASH.sub(" - ", text)
    text = _COMMA.sub(", ", text)
    text = _SPACES.sub(" ", text).strip(_EDGES)
    return _ALIAS_BY_KEY.get(venue_key(text), text)


def _preference(spelling: str, count: int) -> tuple:
    # Separated names read best ("בית החייל - תל אביב"); then the more common spelling;
    # then alphabetical, so the choice does not depend on input order.
    return (-spelling.count(" - "), -count, spelling)


def preferred_spellings(names: list[str]) -> dict[str, str]:
    """For each name, the spelling to show for its venue: one per venue key."""
    counts = Counter(names)
    by_key: dict[str, list[str]] = {}
    for name in counts:
        by_key.setdefault(venue_key(name), []).append(name)
    chosen = {}
    for spellings in by_key.values():
        best = min(spellings, key=lambda s: _preference(s, counts[s]))
        chosen.update({spelling: best for spelling in spellings})
    return chosen


def unify_venues(events: list) -> None:
    """Clean every event's venue in place, one spelling per venue across the list."""
    for event in events:
        event.venue = canonical_venue(event.venue)
    chosen = preferred_spellings([event.venue for event in events])
    for event in events:
        event.venue = chosen[event.venue]
