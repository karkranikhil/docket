import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

from parser import ParsedInvoice, parse_text_message
from utils import format_currency

logger = logging.getLogger("docket.invoice")


def _get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


async def create_draft_invoice(tradie: dict, parsed: ParsedInvoice) -> dict:
    sb = _get_supabase()

    # Atomic invoice counter increment via Postgres RPC — never read-then-write
    counter_result = sb.rpc(
        "increment_invoice_counter",
        {"tradie_row_id": tradie["id"]},
    ).execute()

    if counter_result.data is None:
        raise RuntimeError(
            f"Failed to increment invoice counter for tradie {tradie['id']}. "
            "Ensure the increment_invoice_counter RPC function exists (migration 007)."
        )

    counter = counter_result.data

    invoice_number = f"INV-{counter:04d}"

    line_items_json = [
        {
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "amount": item.amount,
        }
        for item in parsed.items
    ]

    # Find or create client
    client_id = None
    if parsed.client:
        existing = sb.table("clients").select("id").eq(
            "tradie_id", tradie["id"]
        ).ilike("name", parsed.client).limit(1).execute()

        if existing.data:
            client_id = existing.data[0]["id"]
        else:
            new_client = sb.table("clients").insert({
                "tradie_id": tradie["id"],
                "name": parsed.client,
            }).execute()
            if new_client.data:
                client_id = new_client.data[0]["id"]

    due_date = (datetime.now(timezone.utc) + timedelta(days=14)).date().isoformat()

    invoice_data = {
        "tradie_id": tradie["id"],
        "client_id": client_id,
        "invoice_number": invoice_number,
        "line_items": line_items_json,
        "subtotal": parsed.subtotal,
        "gst": parsed.gst,
        "total": parsed.total,
        "status": "draft",
        "due_date": due_date,
        "raw_message": parsed.raw_json,
        "parsed_json": parsed.raw_json,
    }

    result = sb.table("invoices").insert(invoice_data).execute()
    invoice = result.data[0] if result.data else invoice_data
    invoice["invoice_number"] = invoice_number
    invoice["client_name"] = parsed.client

    logger.info("Draft invoice created: %s", invoice_number)
    return invoice


def format_draft_message(invoice: dict, tradie: dict) -> str:
    business = tradie.get("business_name", "Your Business")
    number = invoice.get("invoice_number", "")
    items = invoice.get("line_items", [])
    subtotal = float(invoice.get("subtotal", 0))
    gst = float(invoice.get("gst", 0))
    total = float(invoice.get("total", 0))

    sep = "─" * 30
    lines = [
        f"{business} — Draft Invoice #{number.replace('INV-', '')}",
        sep,
    ]

    for item in items:
        desc = item.get("description", "Item")
        qty = item.get("quantity", 1)
        amount = float(item.get("amount", 0))
        if qty != 1:
            desc = f"{desc} {qty}x"
        lines.append(f"{desc:<24} {format_currency(amount):>10}")

    lines.extend([
        sep,
        f"{'Subtotal':<24} {format_currency(subtotal):>10}",
        f"{'GST (10%)':<24} {format_currency(gst):>10}",
        f"{'TOTAL':<24} {format_currency(total):>10}",
        sep,
        "Reply YES to send",
        "Or tell me what to fix",
    ])

    return "\n".join(lines)


async def confirm_invoice(invoice_id: str, tradie: dict) -> dict:
    sb = _get_supabase()

    # Trigger PDF generation via Edge Function
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    pdf_url = None
    try:
        async with httpx.AsyncClient() as http:
            pdf_resp = await http.post(
                f"{supabase_url}/functions/v1/generate-pdf",
                json={"invoice_id": invoice_id, "tradie_id": tradie["id"]},
                headers={"Authorization": f"Bearer {service_key}"},
                timeout=30.0,
            )
            if pdf_resp.status_code == 200:
                pdf_data = pdf_resp.json()
                pdf_url = pdf_data.get("signed_url")
    except Exception:
        logger.exception("PDF generation failed — continuing without PDF")

    # Create Stripe payment link if enabled
    payment_link_url = None
    try:
        from payments import create_payment_link

        invoice_data = sb.table("invoices").select("*").eq(
            "id", invoice_id
        ).single().execute()
        payment_link_url = await create_payment_link(invoice_data.data, tradie)
    except Exception:
        logger.exception("Payment link creation failed — sending without link")

    update_data: dict = {"status": "sent"}
    if pdf_url:
        update_data["pdf_storage_path"] = pdf_url
    if payment_link_url:
        update_data["stripe_payment_link_url"] = payment_link_url

    sb.table("invoices").update(update_data).eq(
        "id", invoice_id
    ).execute()

    # Re-fetch the full invoice with client name for the confirmation message
    full = sb.table("invoices").select(
        "*, clients(name)"
    ).eq("id", invoice_id).single().execute()

    invoice = full.data if full.data else {}
    invoice["pdf_url"] = pdf_url
    invoice["payment_link_url"] = payment_link_url
    client_rel = invoice.pop("clients", None)
    if client_rel and isinstance(client_rel, dict):
        invoice["client_name"] = client_rel.get("name", "your client")

    logger.info("Invoice %s confirmed and sent", invoice_id)
    return invoice


async def update_invoice(
    invoice_id: str, correction_text: str, tradie: dict
) -> dict:
    sb = _get_supabase()
    parsed = await parse_text_message(correction_text, tradie)

    line_items_json = [
        {
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "amount": item.amount,
        }
        for item in parsed.items
    ]

    result = sb.table("invoices").update({
        "line_items": line_items_json,
        "subtotal": parsed.subtotal,
        "gst": parsed.gst,
        "total": parsed.total,
        "parsed_json": parsed.raw_json,
    }).eq("id", invoice_id).execute()

    invoice = result.data[0] if result.data else {}
    invoice["client_name"] = parsed.client
    return invoice
