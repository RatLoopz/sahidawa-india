import sys
from pathlib import Path

import requests

# Ensure src.* imports resolve when running pytest from the repo root or apps/etl/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.utils import alert_dispatcher


class FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")


def clear_alert_env(monkeypatch):
    monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("DISCORD_WEBHOOK_URL", raising=False)


def test_dispatch_alerts_no_channels_configured(monkeypatch):
    clear_alert_env(monkeypatch)
    post_calls = []

    monkeypatch.setattr(
        alert_dispatcher.requests,
        "post",
        lambda *args, **kwargs: post_calls.append((args, kwargs)),
    )

    alert_dispatcher.dispatch_alerts("summary")

    assert post_calls == []


def test_dispatch_alerts_slack_only(monkeypatch):
    clear_alert_env(monkeypatch)
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/test")
    post_calls = []

    def fake_post(*args, **kwargs):
        post_calls.append((args, kwargs))
        return FakeResponse()

    monkeypatch.setattr(alert_dispatcher.requests, "post", fake_post)

    alert_dispatcher.dispatch_alerts("etl summary")

    assert len(post_calls) == 1
    args, kwargs = post_calls[0]
    assert args == ("https://hooks.slack.example/test",)
    assert kwargs["json"] == {"text": "etl summary"}
    assert kwargs["headers"] == {"Content-Type": "application/json"}
    assert kwargs["timeout"] == alert_dispatcher.REQUEST_TIMEOUT_SECONDS


def test_dispatch_alerts_discord_only(monkeypatch):
    clear_alert_env(monkeypatch)
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.example/webhook")
    post_calls = []

    def fake_post(*args, **kwargs):
        post_calls.append((args, kwargs))
        return FakeResponse(204)

    monkeypatch.setattr(alert_dispatcher.requests, "post", fake_post)

    alert_dispatcher.dispatch_alerts("etl summary")

    assert len(post_calls) == 1
    args, kwargs = post_calls[0]
    assert args == ("https://discord.example/webhook",)
    assert kwargs["json"] == {"content": "etl summary"}
    assert kwargs["headers"] == {"Content-Type": "application/json"}
    assert kwargs["timeout"] == alert_dispatcher.REQUEST_TIMEOUT_SECONDS


def test_dispatch_alerts_both_channels(monkeypatch):
    clear_alert_env(monkeypatch)
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/test")
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.example/webhook")
    post_calls = []

    def fake_post(*args, **kwargs):
        post_calls.append((args, kwargs))
        return FakeResponse()

    monkeypatch.setattr(alert_dispatcher.requests, "post", fake_post)

    alert_dispatcher.dispatch_alerts("etl summary")

    assert {call[0][0] for call in post_calls} == {
        "https://hooks.slack.example/test",
        "https://discord.example/webhook",
    }


def test_slack_failure_does_not_block_discord(monkeypatch):
    clear_alert_env(monkeypatch)
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/test")
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.example/webhook")
    post_calls = []

    def fake_post(url, **kwargs):
        post_calls.append((url, kwargs))
        if "slack" in url:
            raise requests.RequestException("slack unavailable")
        return FakeResponse()

    monkeypatch.setattr(alert_dispatcher.requests, "post", fake_post)

    alert_dispatcher.dispatch_alerts("etl summary")

    assert {call[0] for call in post_calls} == {
        "https://hooks.slack.example/test",
        "https://discord.example/webhook",
    }


def test_discord_failure_does_not_raise(monkeypatch):
    clear_alert_env(monkeypatch)
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.example/webhook")

    def fake_post(*_args, **_kwargs):
        raise requests.RequestException("discord unavailable")

    monkeypatch.setattr(alert_dispatcher.requests, "post", fake_post)

    alert_dispatcher.dispatch_alerts("etl summary")


def test_format_slack_summary_includes_existing_summary_fields():
    message = alert_dispatcher.format_slack_summary(
        "janaushadhi",
        {
            "total": 10,
            "inserted": 8,
            "failed": 2,
            "success_rate": 80.0,
            "error_counts": {"ValidationError": 2},
        },
        status_type="PARTIAL_FAILURE",
    )

    assert message.startswith("⚠️ *SahiDawa ETL Run Summary*")
    assert "• *Status:* PARTIAL_FAILURE" in message
    assert "*SahiDawa ETL Run Summary* [JANAUSHADHI]" in message
    assert "*Status:* PARTIAL_FAILURE" in message
    assert "*Total Rows Processed:* 10" in message
    assert "*Successfully Loaded:* 8" in message
    assert "*Failed Rows:* 2" in message
    assert "*Success Rate:* 80.0%" in message
    assert "*Error Summary:* `{'ValidationError': 2}`" in message


def test_format_slack_summary_uses_success_and_crashed_symbols():
    success_message = alert_dispatcher.format_slack_summary(
        "janaushadhi",
        {"total": 1, "inserted": 1, "failed": 0},
    )
    crashed_message = alert_dispatcher.format_slack_summary(
        "janaushadhi",
        {"total": 0, "inserted": 0, "failed": 1},
        status_type="CRASHED",
    )

    assert success_message.startswith("✅ *SahiDawa ETL Run Summary*")
    assert crashed_message.startswith("🚨 *SahiDawa ETL Run Summary*")
