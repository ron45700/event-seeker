from app.sources import base
from app.sources.base import Source


class Reply:
    text = "ok"

    def raise_for_status(self):
        pass


def test_browser_tls_hosts_use_curl_cffi(monkeypatch):
    calls = []
    monkeypatch.setattr(base.browser_requests, "get", lambda url, **kw: calls.append(("browser", kw)) or Reply())
    monkeypatch.setattr(base.httpx, "get", lambda url, **kw: calls.append(("httpx", kw)) or Reply())

    Source.get_text("https://www.zappa-club.co.il/venue/x-25739/?pnum=2")
    Source.get_text("https://barby.co.il/api/shows")

    assert [client for client, _ in calls] == ["browser", "httpx"]
    assert calls[0][1]["impersonate"] == "chrome"
