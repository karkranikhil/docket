from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from supabase import create_client

from utils import format_currency, format_date, get_gst_quarter

logger = logging.getLogger("docket.commands")

COMMAND_MAP: dict[str, str] = {
    "unpaid": "unpaid",
    "what's owed": "unpaid",
    "whats owed": "unpaid",
    "paid": "paid",
    "last 5": "last5",
    "last5": "last5",
    "show invoices": "last5",
    "remind all": "remind_all",
    "bas": "bas",
    "setup payments": "setup_payments",
    "dashboard": "dashboard",
    "help": "help",
    "stop": "stop",
}


def _get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


def detect_command(message: str) -> str | None:
    text = message.strip().lower()
    if text.startswith("remind ") and text != "remind all":
        return "remind_client"
    return COMMAND_MAP.get(text)


async def handle_command(
    command: str, tradie: dict, message: str
) -> str:
    handlers: dict[str, object] = {
        "unpaid": _handle_unpaid,
        "paid": _handle_paid,
        "last5": _handle_last5,
        "remind_client": _handle_remind_client,
        "remind_all": _handle_remind_all,
        "bas": _handle_bas,
        "setup_payments": _handle_setup_payments,
        "dashboard": _handle_dashboard,
        "help": _handle_help,
        "stop": _handle_stop,
    }
    handler = handlers.get(command, _handle_help)
    return await handler(tradie, message)  # type: ignore[operator]


async def _handle_unpaid(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    result = sb.table("invoices").select("*").eq(
        "tradie_id", tradie["id"]
    ).in_("status", ["sent", "overdue"]).execute()
    invoices = result.data or []

    if not invoices:
        return "No unpaid invoices right now. Nice work! 🎉"

    lines = ["📋 *Unpaid invoices:*\n"]
    total = 0.0
    for inv in invoices:
        created = datetime.fromisoformat(inv["created_at"])
        days = (datetime.now(timezone.utc) - created).days
        lines.append(
            f"• {inv['invoice_number']} — {inv.get('client_name', 'Unknown')} "
            f"— {format_currency(float(inv['total']))} ({days}d ago)"
        )
        total += float(inv["total"])
    lines.append(f"\nTotal outstanding: {format_currency(total)}")
    return "\n".join(lines)


async def _handle_paid(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    result = sb.table("invoices").select("*").eq(
        "tradie_id", tradie["id"]
    ).eq("status", "paid").gte("paid_at", thirty_days_ago).execute()
    invoices = result.data or []

    if not invoices:
        return "No payments received in the last 30 days."

    total = sum(float(inv["total"]) for inv in invoices)
    return (
        f"💰 {len(invoices)} invoices paid in the last 30 days\n"
        f"Total collected: {format_currency(total)}"
    )


async def _handle_last5(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    result = sb.table("invoices").select("*").eq(
        "tradie_id", tradie["id"]
    ).order("created_at", desc=True).limit(5).execute()
    invoices = result.data or []

    if not invoices:
        return "No invoices yet. Send me a job description to create your first one!"

    status_emoji = {
        "draft": "⚪",
        "sent": "🔵",
        "paid": "🟢",
        "overdue": "🔴",
        "void": "⚫",
    }
    lines = ["📄 *Last 5 invoices:*\n"]
    for inv in invoices:
        emoji = status_emoji.get(inv["status"], "⚪")
        created = datetime.fromisoformat(inv["created_at"])
        lines.append(
            f"{emoji} {inv['invoice_number']} — {format_currency(float(inv['total']))} "
            f"— {inv['status']} — {format_date(created)}"
        )
    return "\n".join(lines)


async def _handle_remind_client(tradie: dict, message: str) -> str:
    client_name = message.strip()[7:].strip()  # strip "remind "
    if not client_name:
        return "Who should I remind? Try: remind Mick"

    sb = _get_supabase()
    result = sb.table("invoices").select("*").eq(
        "tradie_id", tradie["id"]
    ).in_("status", ["sent", "overdue"]).ilike(
        "raw_message", f"%{client_name}%"
    ).execute()
    invoices = result.data or []

    if not invoices:
        return f"No unpaid invoices found for '{client_name}'."

    from notifications import send_overdue_reminder

    for inv in invoices:
        created = datetime.fromisoformat(inv["created_at"])
        days = (datetime.now(timezone.utc) - created).days
        await send_overdue_reminder(tradie, inv, days)

    count = len(invoices)
    return f"Sent {count} reminder{'s' if count > 1 else ''} for {client_name}."


async def _handle_remind_all(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = sb.table("invoices").select("*").eq(
        "tradie_id", tradie["id"]
    ).in_("status", ["sent", "overdue"]).lte(
        "created_at", seven_days_ago
    ).execute()
    invoices = result.data or []

    if not invoices:
        return "No invoices overdue by more than 7 days. All good!"

    from notifications import send_overdue_reminder

    for inv in invoices:
        created = datetime.fromisoformat(inv["created_at"])
        days = (datetime.now(timezone.utc) - created).days
        await send_overdue_reminder(tradie, inv, days)

    return f"Sent reminders for {len(invoices)} overdue invoice{'s' if len(invoices) > 1 else ''}."


async def _handle_bas(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    now = datetime.now(timezone.utc)
    q_start, q_end = get_gst_quarter(now)

    result = sb.table("invoices").select("subtotal,gst,total").eq(
        "tradie_id", tradie["id"]
    ).eq("status", "paid").gte(
        "paid_at", q_start.isoformat()
    ).lte(
        "paid_at", q_end.isoformat()
    ).execute()
    invoices = result.data or []

    total_gst = sum(float(inv["gst"]) for inv in invoices)
    total_revenue = sum(float(inv["subtotal"]) for inv in invoices)

    return (
        f"📊 *BAS Summary — {format_date(q_start)} to {format_date(q_end)}*\n\n"
        f"Revenue (ex GST): {format_currency(total_revenue)}\n"
        f"GST collected: {format_currency(total_gst)}\n"
        f"Invoices paid: {len(invoices)}\n\n"
        f"Download full report at docket.com.au/reports"
    )


async def _handle_setup_payments(tradie: dict, _message: str) -> str:
    if tradie.get("stripe_charges_enabled") and tradie.get("stripe_payouts_enabled"):
        return "Your payments are already set up and active! 🟢"

    return (
        "💳 *Get paid faster*\n"
        "Add a bank account so clients can pay your invoices online.\n"
        "Takes 2 minutes. Money lands in your account within 2 business days.\n\n"
        "Set up here: https://docket.com.au/settings/payments"
    )


async def _handle_dashboard(tradie: dict, _message: str) -> str:
    return (
        "📱 View your dashboard at:\n"
        "https://docket.com.au/dashboard\n\n"
        "Check your inbox for a login link, or request one at docket.com.au/login"
    )


async def _handle_help(_tradie: dict, _message: str) -> str:
    return (
        "🛠 *Docket Commands:*\n\n"
        "📋 *unpaid* — see all unpaid invoices\n"
        "💰 *paid* — payments received (last 30 days)\n"
        "📄 *last 5* — your recent invoices\n"
        "🔔 *remind [name]* — nudge a client\n"
        "🔔 *remind all* — nudge everyone overdue 7d+\n"
        "📊 *bas* — BAS quarter summary\n"
        "💳 *setup payments* — enable online payments\n"
        "📱 *dashboard* — link to your web dashboard\n"
        "🛑 *stop* — pause automated messages\n\n"
        "Or just describe a job to create an invoice!"
    )


async def _handle_stop(tradie: dict, _message: str) -> str:
    sb = _get_supabase()
    sb.table("tradies").update({
        "weekly_summary_enabled": False,
        "reminders_enabled": False,
    }).eq("id", tradie["id"]).execute()

    return (
        "Automated messages paused. You can still create invoices "
        "and use commands.\n\n"
        "To re-enable, visit docket.com.au/settings"
    )
