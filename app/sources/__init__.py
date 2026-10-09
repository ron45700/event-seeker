"""Registry of active sources. To add a site: write a class and add it to the list."""
from app.sources.barby import BarbySource
from app.sources.base import Source
from app.sources.comy import ComySource
from app.sources.kupat import KupatSource
from app.sources.reading3 import Reading3Source
from app.sources.zappa import ZappaSource

ALL_SOURCES: list[Source] = [
    BarbySource(),
    Reading3Source(),
    ZappaSource(),
    KupatSource(),
    ComySource(),
]
