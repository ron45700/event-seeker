"""Admin sign-in: server-side sessions and a throttle on wrong passwords.

The admin is whoever knows ADMIN_PASSWORD. A correct password starts a session: a random
token in an httponly cookie, valid for SESSION_SECONDS and known only to this process. The
browser never holds the password or anything derived from it, and the user cookie (a plain
email that anyone can forge) grants nothing here.

Everything is kept in memory: a restart signs the admin out and clears lockouts.
"""
import hmac
import math
import secrets
import threading
import time

from app import config

SESSION_SECONDS = 4 * 60 * 60
MAX_FAILURES = 5  # wrong passwords in a row before the lockout
LOCKOUT_SECONDS = 5 * 60


class Locked(Exception):
    """Too many wrong passwords from this client; try again in retry_after seconds.
    started: this attempt was the wrong password that started the lockout."""

    def __init__(self, retry_after: int, started: bool = False):
        super().__init__(f"locked for {retry_after}s")
        self.retry_after = retry_after
        self.started = started


class WrongPassword(Exception):
    """failures: wrong passwords in a row from this client, this one included."""

    def __init__(self, failures: int):
        super().__init__(f"wrong password ({failures} in a row)")
        self.failures = failures


def password_matches(password: str) -> bool:
    # Constant-time comparison, so response timing says nothing about the password.
    return hmac.compare_digest(password.encode(), config.ADMIN_PASSWORD.encode())


class AdminAuth:
    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._lock = threading.Lock()
        self._sessions: dict[str, float] = {}  # token -> expiry
        self._failures: dict[str, int] = {}  # client -> wrong passwords in a row
        self._locked_until: dict[str, float] = {}  # client -> end of its lockout

    def login(self, client: str, password: str) -> str:
        """A new session token for the right password.

        Raises Locked while the client is locked out (even for the right password, so a
        lockout cannot be used to test guesses), WrongPassword for a wrong one, and Locked
        for the wrong password that reaches MAX_FAILURES.
        """
        with self._lock:
            now = self._clock()
            until = self._locked_until.get(client, 0.0)
            if until > now:
                raise Locked(math.ceil(until - now))
            self._locked_until.pop(client, None)
            if not password_matches(password):
                failures = self._failures.get(client, 0) + 1
                if failures >= MAX_FAILURES:
                    self._failures.pop(client, None)
                    self._locked_until[client] = now + LOCKOUT_SECONDS
                    raise Locked(LOCKOUT_SECONDS, started=True)
                self._failures[client] = failures
                raise WrongPassword(failures)
            self._failures.pop(client, None)
            self._prune(now)
            token = secrets.token_urlsafe(32)
            self._sessions[token] = now + SESSION_SECONDS
            return token

    def valid(self, token: str) -> bool:
        if not token:
            return False
        with self._lock:
            expiry = self._sessions.get(token)
            if expiry is None:
                return False
            if expiry <= self._clock():
                del self._sessions[token]
                return False
            return True

    def logout(self, token: str) -> None:
        with self._lock:
            self._sessions.pop(token, None)

    def _prune(self, now: float) -> None:
        for token in [t for t, expiry in self._sessions.items() if expiry <= now]:
            del self._sessions[token]
