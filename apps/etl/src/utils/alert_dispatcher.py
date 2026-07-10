import os
from typing import Callable

import requests

from src.utils.logger import logger

REQUEST_TIMEOUT_SECONDS = 10


def format_slack_summary(pipeline_name: str, stats: dict, status_type: str = "COMPLETED") -> str:
    """Format ETL stats using the existing Slack markdown summary."""
    emoji = "⚠️" if stats.get("failed", 0) > 0 else "✅"
    if status_type == "CRASHED":
        emoji = "🚨"

    msg = (
        f"{emoji} *SahiDawa ETL Run Summary* [{pipeline_name.upper()}]\n"
        f"• *Status:* {status_type}\n"
        f"• *Total Rows Processed:* {stats.get('total', 0)}\n"
        f"• *Successfully Loaded:* {stats.get('inserted', 0)}\n"
        f"• *Failed Rows:* {stats.get('failed', 0)}\n"
        f"• *Success Rate:* {stats.get('success_rate', 100.0)}%\n"
    )

    if stats.get("error_counts"):
        msg += f"• *Error Summary:* `{stats['error_counts']}`\n"

    return msg


def format_discord_summary(summary_text: str) -> dict[str, str]:
    """Format an ETL summary for a Discord webhook."""
    return {"content": summary_text}


def send_slack_notification(webhook_url: str, summary_text: str) -> bool:
    """Send an ETL summary to Slack without raising into the pipeline."""
    payload = {"text": summary_text}
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()

        logger.info("[Notifier] ETL summary notification successfully send ho gayi.")
        return True
    except Exception as exc:
        logger.error("[Notifier] Slack webhook notification bhejte waqt error aaya: %s", exc)
        return False


def send_discord_notification(webhook_url: str, summary_text: str) -> bool:
    """Send an ETL summary to Discord without raising into the pipeline."""
    try:
        response = requests.post(
            webhook_url,
            json=format_discord_summary(summary_text),
            headers={"Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()

        logger.info("[Notifier] Discord ETL summary notification sent successfully.")
        return True
    except Exception as exc:
        logger.error("[Notifier] Discord webhook notification failed: %s", exc)
        return False


def _configured_channels() -> list[tuple[str, str, Callable[[str, str], bool]]]:
    channels: list[tuple[str, str, Callable[[str, str], bool]]] = []
    slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL")

    if slack_webhook_url:
        channels.append(("Slack", slack_webhook_url, send_slack_notification))
    if discord_webhook_url:
        channels.append(("Discord", discord_webhook_url, send_discord_notification))

    return channels


def dispatch_alerts(summary_text: str) -> None:
    """Dispatch an ETL summary to every configured alert channel."""
    for channel_name, webhook_url, send_notification in _configured_channels():
        try:
            send_notification(webhook_url, summary_text)
        except Exception:
            logger.exception("[Notifier] Failed to dispatch %s ETL alert", channel_name)
