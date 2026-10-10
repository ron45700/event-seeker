"""Settings from the environment. A .env file is loaded if present, with no extra dependency."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(ROOT / ".env")

DB_PATH = Path(os.environ.get("DB_PATH", "data/event_seeker.db"))
if not DB_PATH.is_absolute():
    DB_PATH = ROOT / DB_PATH
FETCH_INTERVAL_MINUTES = int(os.environ.get("FETCH_INTERVAL_MINUTES", "60"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8765"))
THUMB_DIR = DB_PATH.parent / "thumbs"  # cached card thumbnails, safe to delete
THUMB_WIDTH = int(os.environ.get("THUMB_WIDTH", "480"))  # px; cards are about 240 CSS px at 2x
WEB_DIR = ROOT / "web"  # built UI files, served at / when the folder exists

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")  # Google displays the password with spaces

# Global switch, off by default: no email goes to any subscriber and alerts wait in the queue
EMAIL_ENABLED = os.environ.get("EMAIL_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")

# Operator alerts (Telegram). Both empty = no messages; source health is still tracked.
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
# A source counts as broken after this many failed runs in a row (one run per FETCH_INTERVAL_MINUTES)
SOURCE_ALERT_AFTER_FAILURES = int(os.environ.get("SOURCE_ALERT_AFTER_FAILURES", "3"))

# Admin panel (/#/admin, /api/admin/*). Empty ADMIN_PASSWORD turns the feature off entirely:
# every admin route answers 404. The password is only ever compared on the server.
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
if not ADMIN_PASSWORD.strip():
    ADMIN_PASSWORD = ""
# Optional: show the admin entry in the account menu only to this signed-in email. Cosmetic;
# the password is the protection.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
