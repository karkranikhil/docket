from __future__ import annotations

import asyncio
import logging
import os

from fastapi import APIRouter, Form, Request, Response
from twilio.request_validator import RequestValidator

from commands import detect_command, handle_command
from invoice import confirm_invoice, create_draft_invoice, format_draft_message, update_invoice
from notifications import send_message
from parser import parse_image_message, parse_text_message, parse_voice_message
from message_queue import process_queue
from utils import validate_abn

logger = logging.getLogger("docket.webhook")

router = APIRouter()

# In-memory draft tracking: whatsapp_number -> invoice_id
_pending_drafts: dict[str, str] = {}


def _get_supabase():
    from supabase import create_client

    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


def _validate_twilio_signature(request: Request, form_data: dict) -> bool:
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not auth_token:
        logger.error("TWILIO_AUTH_TOKEN not set — cannot validate signature")
        return False

    validator = RequestValidator(auth_token)
    signature = request.headers.get("X-Twilio-Signature", "")

    # Behind a reverse proxy (Railway, Vercel, etc.) request.url uses the
    # internal scheme/host. Reconstruct the public URL that Twilio signed.
    proto = request.headers.get("X-Forwarded-Proto", "https")
    host = request.headers.get("X-Forwarded-Host") or request.headers.get("Host", "")
    url = f"{proto}://{host}{request.url.path}"

    return validator.validate(url, form_data, signature)


def _log_inbound(
    phone: str,
    message_type: str,
    content: str | None,
    twilio_sid: str,
    tradie_id: str | None = None,
) -> None:
    try:
        sb = _get_supabase()
        sb.table("message_log").insert({
            "tradie_id": tradie_id,
            "whatsapp_number": phone,
            "direction": "inbound",
            "message_type": message_type,
            "raw_content": content,
            "twilio_sid": twilio_sid,
            "processing_status": "received",
        }).execute()
    except Exception:
        logger.exception("Failed to log inbound message")


@router.post("/webhook")
async def handle_webhook(request: Request) -> Response:
    form = await request.form()
    form_data = dict(form)

    if not _validate_twilio_signature(request, form_data):
        logger.warning("Invalid Twilio signature — rejecting")
        return Response(status_code=403)

    body = str(form_data.get("Body", "")).strip()
    from_number = str(form_data.get("From", "")).replace("whatsapp:", "")
    media_url = str(form_data.get("MediaUrl0", ""))
    media_type = str(form_data.get("MediaContentType0", ""))
    message_sid = str(form_data.get("MessageSid", ""))
    num_media = int(form_data.get("NumMedia", 0))

    message_type = "text"
    if num_media > 0:
        if "image" in media_type:
            message_type = "image"
        elif "audio" in media_type or "ogg" in media_type:
            message_type = "audio"

    # Acknowledge Twilio immediately, process async
    asyncio.create_task(
        _process_message(
            from_number, body, message_type, media_url,
            message_sid, form_data,
        )
    )
    return Response(content="", media_type="text/xml", status_code=200)


async def _process_message(
    from_number: str,
    body: str,
    message_type: str,
    media_url: str,
    message_sid: str,
    form_data: dict,
) -> None:
    try:
        sb = _get_supabase()

        # Process any queued messages for this number
        await process_queue(from_number)

        # Look up tradie
        result = sb.table("tradies").select("*").eq(
            "whatsapp_number", from_number
        ).execute()
        tradie = result.data[0] if result.data else None

        # Log inbound
        _log_inbound(
            from_number, message_type, body, message_sid,
            tradie["id"] if tradie else None,
        )

        if not tradie:
            await _handle_onboarding(from_number, body)
            return

        if tradie.get("subscription_status") == "canceled":
            await send_message(
                from_number,
                "Your Docket subscription has ended.\n"
                "Renew at docket.com.au/billing to keep invoicing.",
                tradie["id"],
            )
            return

        # Check for YES confirmation on pending draft
        if body.upper() in ("YES", "Y", "SEND") and from_number in _pending_drafts:
            invoice_id = _pending_drafts.pop(from_number)
            invoice = await confirm_invoice(invoice_id, tradie)
            from notifications import send_invoice_confirmed
            await send_invoice_confirmed(tradie, invoice)

            # Nudge for payment setup after invoice 1 and 3
            counter = tradie.get("invoice_counter", 0)
            if counter in (1, 3) and not tradie.get("stripe_charges_enabled"):
                from notifications import send_payment_setup_nudge
                await send_payment_setup_nudge(tradie, counter)
            return

        # Check for cancellation on pending draft
        if from_number in _pending_drafts and body.upper() in ("NO", "N", "CANCEL"):
            _pending_drafts.pop(from_number)
            await send_message(from_number, "Invoice cancelled.", tradie["id"])
            return

        # Check for correction on pending draft
        if from_number in _pending_drafts:
            invoice_id = _pending_drafts[from_number]
            updated = await update_invoice(invoice_id, body, tradie)
            msg = format_draft_message(updated, tradie)
            await send_message(from_number, msg, tradie["id"])
            return

        # Check for command keywords
        command = detect_command(body)
        if command:
            reply = await handle_command(command, tradie, body)
            await send_message(from_number, reply, tradie["id"])
            return

        # Invoice creation flow
        try:
            if message_type == "image":
                parsed = await parse_image_message(media_url, tradie)
            elif message_type == "audio":
                parsed = await parse_voice_message(media_url, tradie)
            else:
                parsed = await parse_text_message(body, tradie)

            if parsed.confidence < 0.7:
                _log_parse_low_confidence(from_number, body, parsed, tradie["id"])
                await send_message(
                    from_number,
                    "I wasn't sure about some details. Could you be more specific?\n\n"
                    "Try: \"Labour 2hrs $80/hr, tap $95, for Mick Smith\"",
                    tradie["id"],
                )
                return

            invoice = await create_draft_invoice(tradie, parsed)
            msg = format_draft_message(invoice, tradie)
            await send_message(from_number, msg, tradie["id"])
            _pending_drafts[from_number] = invoice["id"]

        except Exception:
            logger.exception("Invoice parsing failed for %s", from_number)
            await send_message(
                from_number,
                "Sorry, I couldn't understand that. Try describing the job like:\n\n"
                "\"Labour 3hrs $80/hr, 10m copper pipe $45, for Sarah Jones\"",
                tradie["id"],
            )

    except Exception:
        logger.exception("Error processing message from %s", from_number)


async def _handle_onboarding(phone: str, body: str) -> None:
    if not body:
        await send_message(
            phone,
            "G'day! I'm Docket — I turn your job description into "
            "a legal GST invoice in under 30 seconds.\n\n"
            "To get started, reply with:\n"
            "Name, business name, and ABN\n\n"
            "Example:\n"
            "Dave Wilson, Dave's Plumbing, ABN 12 345 678 901\n\n"
            "Or sign up at docket.com.au to start your free 30-day trial first.",
        )
        return

    parts = [p.strip() for p in body.split(",")]
    if len(parts) < 3:
        await send_message(
            phone,
            "I need your name, business name, and ABN separated by commas.\n\n"
            "Example: Dave Wilson, Dave's Plumbing, ABN 12 345 678 901",
        )
        return

    name = parts[0]
    business_name = parts[1]
    abn_raw = parts[2].upper().replace("ABN", "").strip()

    if not validate_abn(abn_raw):
        await send_message(
            phone,
            "That ABN doesn't look right. Please check and try again.\n"
            "ABNs are 11 digits — e.g. 12 345 678 901",
        )
        return

    try:
        sb = _get_supabase()
        from datetime import datetime, timedelta, timezone

        trial_end = datetime.now(timezone.utc) + timedelta(days=30)

        sb.table("tradies").insert({
            "whatsapp_number": phone,
            "business_name": business_name,
            "abn": abn_raw.replace(" ", ""),
            "email": "",
            "trial_ends_at": trial_end.isoformat(),
        }).execute()

        await send_message(
            phone,
            f"Welcome to Docket, {name}! 🎉\n\n"
            f"You're set up as {business_name} (ABN {abn_raw}).\n"
            f"Your 30-day free trial has started.\n\n"
            f"Now just describe a job and I'll create an invoice.\n"
            f"Example: \"Labour 2hrs $80/hr, mixer tap $95, for Mick Smith\"",
        )
    except Exception:
        logger.exception("Onboarding failed for %s", phone)
        await send_message(
            phone,
            "Something went wrong setting up your account. "
            "Please try again or sign up at docket.com.au",
        )


def _log_parse_low_confidence(
    phone: str, body: str, parsed: object, tradie_id: str
) -> None:
    try:
        sb = _get_supabase()
        sb.table("message_log").insert({
            "tradie_id": tradie_id,
            "whatsapp_number": phone,
            "direction": "inbound",
            "message_type": "text",
            "raw_content": body,
            "processing_status": "low_confidence",
        }).execute()
    except Exception:
        logger.exception("Failed to log low-confidence parse")
