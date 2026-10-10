"""Card thumbnails. Venue images are 100-700 KB each, too heavy for a phone grid,
so they are downscaled once and cached on disk.
"""
import hashlib
import io
import logging
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image

from app import config
from app.sources.base import Source

log = logging.getLogger(__name__)


def fetch_bytes(url: str) -> bytes:
    origin = "{0.scheme}://{0.netloc}/".format(urlsplit(url))
    return Source._get(url, {"Referer": origin, "Accept": "image/*"}).content


def thumbnail_path(image_url: str) -> Path:
    # keyed by the source URL, so a changed image gets a fresh thumbnail
    key = hashlib.sha1(f"{config.THUMB_WIDTH}:{image_url}".encode()).hexdigest()[:20]
    return config.THUMB_DIR / f"{key}.webp"


def prune(keep_urls: set[str]) -> int:
    """Delete cached thumbnails that belong to none of keep_urls: images of events that were
    purged, images a source replaced, and sizes from an earlier THUMB_WIDTH. Images are often
    shared (a comedian's photo on every date), so the cache is pruned against every stored
    event rather than per deleted event. Returns how many files were deleted."""
    if not config.THUMB_DIR.is_dir():
        return 0
    keep = {thumbnail_path(url).name for url in keep_urls}
    removed = 0
    for path in config.THUMB_DIR.glob("*.webp"):
        if path.name not in keep:
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def get_thumbnail(image_url: str) -> Path | None:
    """Path of the cached thumbnail, creating it on first use. None if it cannot be made."""
    path = thumbnail_path(image_url)
    if path.exists():
        return path
    try:
        image = Image.open(io.BytesIO(fetch_bytes(image_url)))
        image = image.convert("RGBA" if "A" in image.getbands() or image.mode == "P" else "RGB")
        image.thumbnail((config.THUMB_WIDTH, config.THUMB_WIDTH * 2))  # keeps the aspect ratio
        config.THUMB_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        image.save(tmp, "WEBP", quality=80)
        tmp.replace(path)
        return path
    except Exception:
        log.warning("could not build thumbnail for %s", image_url, exc_info=True)
        return None
