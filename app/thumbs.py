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


def get_thumbnail(image_url: str) -> Path | None:
    """Path of the cached thumbnail, creating it on first use. None if it cannot be made."""
    # keyed by the source URL, so a changed image gets a fresh thumbnail
    key = hashlib.sha1(f"{config.THUMB_WIDTH}:{image_url}".encode()).hexdigest()[:20]
    path = config.THUMB_DIR / f"{key}.webp"
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
