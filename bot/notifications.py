from __future__ import annotations

import logging
import os

from twilio.rest import Client

from utils import format_currency

logger = logging.getLogger("docket.notifications")


def _get_twilio() -> Client:
    return Client(
        os.getenv("TWILIO_ACCOUNT_SID", ""),
        os.getenv("TWILIO_AUTH_TOKEN", ""),
    )


def _get_supabase():
    from supabase import create_client

    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


def _log_outbound(phone: str, body: str, sid: str, tradie_id: str | None = None) -> None:
    try:
        sb = _get_supabase()
        sb.table("message_log").insert({
            "tradie_id": tradie_id,
            "whatsapp_number": phone,
            "direction": "outbound",
            "message_type": "text",
            "raw_content": body,
            "twilio_sid": sid,
            "processing_status": "replied",
        }).execute()
    except Exception:
        logger.exception("Failed to log outbound message")


async def send_message(to: str, body: str, tradie_id: str | None = None) -> str:
    client = _get_twilio()
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

    message = client.messages.create(
        from_=from_number,
        to=f"whatsapp:{to}" if not to.startswith("whatsapp:") else to,
        body=body,
    )
    _log_outbound(to, body, message.sid, tradie_id)
    logger.info("Sent message to %s (SID: %s)", to, message.sid)
    return message.sid


async def send_invoice_confirmed(tradie: dict, invoice: dict) -> None:
    from utils import format_date
    from datetime import datetime, timezone

    phone = tradie.get("whatsapp_number", "")
    business = tradie.get("business_name", "")
    abn = tradie.get("abn", "")
    number = invoice.get("invoice_number", "")
    items = invoice.get("line_items", [])
    subtotal = float(invoice.get("subtotal", 0))
    gst = float(invoice.get("gst", 0))
    total = float(invoice.get("total", 0))
    client_name = invoice.get("client_name", "your client")
    pdf_url = invoice.get("pdf_url") or invoice.get("pdf_storage_path")
    payment_url = invoice.get("payment_link_url") or invoice.get("stripe_payment_link_url")
    date_str = format_date(datetime.now(timezone.utc))

    sep = "─" * 30
    lines = [
        f"*{business}*",
        f"ABN {abn}" if abn else "",
        "",
        f"*TAX INVOICE {number}*",
        f"Date: {date_str}",
        f"To: {client_name}",
        sep,
    ]

    for item in items:
        desc = item.get("description", "Item")
        qty = item.get("quantity", 1)
        amount = float(item.get("amount", 0))
        if qty != 1:
            desc = f"{desc} x{qty}"
        lines.append(f"{desc:<24} {format_currency(amount):>10}")

    lines.extend([
        sep,
        f"{'Subtotal':<24} {format_currency(subtotal):>10}",
        f"{'GST (10%)':<24} {format_currency(gst):>10}",
        f"*{'TOTAL':<24} {format_currency(total):>10}*",
        sep,
    ])

    if payment_url:
        lines.extend(["", f"💳 *Pay online:* {payment_url}"])

    if pdf_url:
        lines.extend(["", f"📄 *Download PDF:* {pdf_url}"])

    if not payment_url:
        lines.extend(["", "Tip: Set up payments so clients can pay online → type 'setup payments'"])

    lines.extend(["", f"_Forward this to {client_name} to get paid._"])

    body = "\n".join(line for line in lines if line is not None)
    await send_message(phone, body, tradie.get("id"))


async def send_payment_received(
    tradie: dict, invoice: dict, amount: float
) -> None:
    phone = tradie.get("whatsapp_number", "")
    client_name = invoice.get("client_name", "Your client")
    await send_message(
        phone,
        f"{client_name} paid {format_currency(amount)} ✓",
        tradie.get("id"),
    )


async def send_overdue_reminder(
    tradie: dict, invoice: dict, days_overdue: int
) -> None:
    phone = tradie.get("whatsapp_number", "")
    number = invoice.get("invoice_number", "")
    total = format_currency(float(invoice.get("total", 0)))
    client_name = invoice.get("client_name", "your client")
    pay_url = invoice.get("stripe_payment_link_url", "")

    if days_overdue < 14:
        body = (
            f"Just a reminder that Invoice #{number} to {client_name} "
            f"for {total} is now {days_overdue} days overdue."
        )
    elif days_overdue < 30:
        body = (
            f"Invoice #{number} ({total} from {client_name}) is now "
            f"{days_overdue} days overdue. Please action this."
        )
    else:
        body = (
            f"Final notice: Invoice #{number} for {total} is {days_overdue} "
            f"days overdue. If payment isn't received this week, you may "
            f"need to pursue this through AFCA or a debt collector."
        )

    if pay_url:
        body += f"\nPay link: {pay_url}"

    await send_message(phone, body, tradie.get("id"))


async def send_weekly_summary(tradie: dict) -> None:
    from datetime import datetime, timedelta, timezone

    sb = _get_supabase()
    phone = tradie.get("whatsapp_number", "")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    paid = sb.table("invoices").select("total").eq(
        "tradie_id", tradie["id"]
    ).eq("status", "paid").gte("paid_at", week_ago).execute()
    collected = sum(float(i["total"]) for i in (paid.data or []))

    sent = sb.table("invoices").select("id").eq(
        "tradie_id", tradie["id"]
    ).gte("created_at", week_ago).execute()
    sent_count = len(sent.data or [])

    outstanding = sb.table("invoices").select("total").eq(
        "tradie_id", tradie["id"]
    ).in_("status", ["sent", "overdue"]).execute()
    outstanding_total = sum(float(i["total"]) for i in (outstanding.data or []))

    body = (
        f"📊 *Weekly Summary*\n\n"
        f"Collected: {format_currency(collected)}\n"
        f"Invoices sent: {sent_count}\n"
        f"Outstanding: {format_currency(outstanding_total)}\n\n"
        f"Have a great week! 💪"
    )
    await send_message(phone, body, tradie.get("id"))


async def send_payment_setup_nudge(tradie: dict, invoice_count: int) -> None:
    phone = tradie.get("whatsapp_number", "")
    body = (
        f"You've sent {invoice_count} invoice{'s' if invoice_count > 1 else ''} "
        f"— nice work!\n\n"
        f"💳 Want clients to pay online? Set up in 2 min:\n"
        f"https://docket.com.au/settings/payments"
    )
    await send_message(phone, body, tradie.get("id"))
