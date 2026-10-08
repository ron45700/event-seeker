"""The unified format every source converts into."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Event:
    source: str            # source name, e.g. "barby"
    external_id: str       # stable id at the source. Unique together with source
    title: str             # title as shown on the site
    starts_at: datetime    # Israel local time
    venue: str
    city: str
    url: str
    kind: str = "show"     # "show" or "festival"
    artists: list[str] = field(default_factory=list)  # guests / festival lineup
    ends_at: datetime | None = None                   # for multi-day events
    price: str | None = None
    image_url: str | None = None

    def searchable_text(self) -> str:
        """All the text an artist name is searched in."""
        return " | ".join([self.title, *self.artists])
