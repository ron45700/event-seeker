"""Sending alerts. Email goes only to a registered user whose subscription matches a new event.

The email content itself is in Hebrew, the language of the product.
"""
import logging
import smtplib
from email.message import EmailMessage
from html import escape
from typing import Protocol

from app import config
from app.models import Event

log = logging.getLogger(__name__)

_DAYS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]


class Notifier(Protocol):
    def send(self, email: str, events: list[Event]) -> None:
        """Send one combined message. Raises if sending failed."""


def _when(event: Event) -> str:
    return f"יום {_DAYS[event.starts_at.weekday()]} {event.starts_at:%d/%m/%Y} בשעה {event.starts_at:%H:%M}"


def build_message(sender: str, email: str, events: list[Event]) -> EmailMessage:
    if len(events) == 1:
        subject = f"הופעה חדשה: {events[0].title} ב{events[0].venue}"
    else:
        subject = f"{len(events)} הופעות חדשות שחיכית להן"

    text = "\n\n".join(
        f"{e.title}\n{e.venue}, {e.city}\n{_when(e)}\nכרטיסים: {e.url}" for e in events
    )
    cards = "".join(
        f"""<div style="border:1px solid #e3e3e3;border-radius:10px;padding:16px;margin:0 0 12px">
<div style="font-size:18px;font-weight:bold;margin-bottom:6px">{escape(e.title)}</div>
<div style="color:#555">{escape(e.venue)}, {escape(e.city)}</div>
<div style="color:#555;margin-bottom:12px">{escape(_when(e))}</div>
<a href="{escape(e.url, quote=True)}" style="background:#111;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">לכרטיסים</a>
</div>"""
        for e in events
    )
    html = f"""<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right">
<h2 style="margin:0 0 16px">נוספו הופעות שמתאימות למנויים שלך</h2>
{cards}
<div style="color:#999;font-size:12px">נשלח מ-event_seeker</div>
</div>"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Event Seeker <{sender}>"
    msg["To"] = email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


class SmtpNotifier:
    def send(self, email: str, events: list[Event]) -> None:
        msg = build_message(config.SMTP_USER, email, events)
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
        log.info("sent %d event(s) to %s", len(events), email)


def get_notifier() -> Notifier | None:
    """Returns None when email is off. Alerts then stay in the queue and are not sent."""
    if not config.EMAIL_ENABLED:
        log.info("EMAIL_ENABLED is off, no emails will be sent")
        return None
    if not (config.SMTP_USER and config.SMTP_PASSWORD):
        log.warning("EMAIL_ENABLED is on but SMTP_USER / SMTP_PASSWORD are missing, no emails will be sent")
        return None
    return SmtpNotifier()
