from datetime import datetime

from app.models import Event
from app.notifier import build_message


def make(title, url="https://example.com/1"):
    return Event("s", "1", title, datetime(2026, 11, 13, 14, 0), "רידינג 3", "תל אביב", url)


def test_single_event_message():
    msg = build_message("me@example.com", "ron@example.com", [make("מוניקה סקס")])
    assert msg["To"] == "ron@example.com"
    assert msg["Subject"] == "הופעה חדשה: מוניקה סקס ברידינג 3"
    text = msg.get_body(("plain",)).get_content()
    assert "יום שישי 13/11/2026 בשעה 14:00" in text
    assert "https://example.com/1" in text


def test_multiple_events_and_html_escaping():
    msg = build_message("me@example.com", "ron@example.com", [make("A <b>"), make("B")])
    assert msg["Subject"] == "2 הופעות חדשות שחיכית להן"
    html = msg.get_body(("html",)).get_content()
    assert "A &lt;b&gt;" in html and 'dir="rtl"' in html
