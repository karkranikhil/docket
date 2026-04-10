from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

logger = logging.getLogger("docket.queue")

QUEUE_DIR = Path(os.getenv("QUEUE_DIR", "/tmp/docket_queue"))
MAX_RETRIES = 3


def _ensure_queue_dir() -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)


def queue_message(phone: str, message_data: dict) -> str:
    """Queue a message for later processing. Returns the queue entry ID."""
    _ensure_queue_dir()
    entry_id = f"{phone}_{int(time.time() * 1000)}"
    entry = {
        "id": entry_id,
        "phone": phone,
        "data": message_data,
        "retries": 0,
        "created_at": time.time(),
        "last_attempt": None,
        "status": "pending",
    }
    path = QUEUE_DIR / f"{entry_id}.json"
    path.write_text(json.dumps(entry))
    logger.info("Queued message %s for %s", entry_id, phone)
    return entry_id


async def process_queue(phone: str | None = None) -> int:
    """Process queued messages, optionally filtering by phone. Returns count processed."""
    _ensure_queue_dir()
    processed = 0

    for path in sorted(QUEUE_DIR.glob("*.json")):
        try:
            entry = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Corrupt queue entry: %s", path)
            path.unlink(missing_ok=True)
            continue

        if entry.get("status") in ("completed", "failed"):
            continue

        if phone and entry.get("phone") != phone:
            continue

        if entry.get("retries", 0) >= MAX_RETRIES:
            entry["status"] = "failed"
            path.write_text(json.dumps(entry))
            logger.warning("Queue entry %s exceeded max retries", entry["id"])
            continue

        try:
            await _process_entry(entry)
            entry["status"] = "completed"
            path.write_text(json.dumps(entry))
            processed += 1
        except Exception:
            entry["retries"] = entry.get("retries", 0) + 1
            entry["last_attempt"] = time.time()
            path.write_text(json.dumps(entry))
            logger.exception("Failed to process queue entry %s (attempt %d)", entry["id"], entry["retries"])

    return processed


async def _process_entry(entry: dict) -> None:
    """Re-process a queued message through the webhook handler."""
    from notifications import send_message

    data = entry.get("data", {})
    action = data.get("action")

    if action == "send_message":
        await send_message(
            data["to"],
            data["body"],
            data.get("tradie_id"),
        )
    elif action == "reply":
        await send_message(
            entry["phone"],
            data["body"],
            data.get("tradie_id"),
        )
    else:
        logger.warning("Unknown queue action: %s", action)


def cleanup_completed(max_age_hours: int = 24) -> int:
    """Remove completed/failed entries older than max_age_hours."""
    _ensure_queue_dir()
    cutoff = time.time() - (max_age_hours * 3600)
    removed = 0

    for path in QUEUE_DIR.glob("*.json"):
        try:
            entry = json.loads(path.read_text())
            if entry.get("status") in ("completed", "failed") and entry.get("created_at", 0) < cutoff:
                path.unlink()
                removed += 1
        except (json.JSONDecodeError, OSError):
            path.unlink(missing_ok=True)
            removed += 1

    return removed
