"""Operator alerts: messages to the person running the system, not to subscribers.

Sent to one Telegram chat through a bot. Used when a source keeps failing, so a broken
venue site is noticed instead of silently producing no shows. Any other part of the system
that needs to reach the operator should go through get_alerter() as well.
"""
import logging
from typing import Protocol

import httpx

from app import config

log = logging.getLogger(__name__)


class Alerter(Protocol):
    def send(self, text: str) -> None:
        """Send one message. Raises if sending failed."""


class TelegramAlerter:
    def __init__(self, token: str, chat_id: str) -> None:
        self.token, self.chat_id = token, chat_id

    def send(self, text: str) -> None:
        try:
            response = httpx.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                json={"chat_id": self.chat_id, "text": text, "disable_web_page_preview": True},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            # the request URL holds the bot token, so it must not reach the log through the traceback
            raise RuntimeError(f"Telegram request failed: {type(exc).__name__}") from None
        if response.status_code != 200:
            raise RuntimeError(f"Telegram answered {response.status_code}: {response.text[:200]}")


def get_alerter() -> Alerter | None:
    """Returns None when Telegram is not configured. Source health is still tracked and
    shown by /health; only the messages are skipped."""
    if not (config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID):
        return None
    return TelegramAlerter(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID)
