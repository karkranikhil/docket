from __future__ import annotations

import logging
import os

import stripe
from supabase import create_client

logger = logging.getLogger("docket.payments")


def _get_stripe() -> None:
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


def _get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


async def get_or_create_connect_account(tradie: dict) -> str:
    _get_stripe()
    sb = _get_supabase()

    if tradie.get("stripe_account_id"):
        return tradie["stripe_account_id"]

    account = stripe.Account.create(
        type="express",
        country="AU",
        email=tradie.get("email", ""),
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_type="individual",
        business_profile={"mcc": "1711", "url": "https://docket.com.au"},
    )

    sb.table("tradies").update(
        {"stripe_account_id": account.id}
    ).eq("id", tradie["id"]).execute()

    logger.info("Created Stripe Connect account %s for tradie %s", account.id, tradie["id"])
    return account.id


async def create_onboarding_link(account_id: str) -> str:
    _get_stripe()
    base_url = os.getenv("NEXT_PUBLIC_URL", "https://docket.com.au")

    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{base_url}/settings/payments/refresh",
        return_url=f"{base_url}/settings/payments/done",
        type="account_onboarding",
    )
    return link.url


async def create_payment_link(invoice: dict, tradie: dict) -> str | None:
    """Create a Stripe payment link for an invoice.

    Returns None if Stripe not fully set up — don't block invoice sending.
    """
    if not tradie.get("stripe_charges_enabled") or not tradie.get("stripe_payouts_enabled"):
        return None

    _get_stripe()
    sb = _get_supabase()

    total_cents = int(float(invoice["total"]) * 100)
    fee_cents = round(total_cents * 0.005)  # 0.5% platform fee

    payment_link = stripe.PaymentLink.create(
        line_items=[{
            "price_data": {
                "currency": "aud",
                "unit_amount": total_cents,
                "product_data": {
                    "name": f"Invoice {invoice.get('invoice_number', '')}",
                    "description": tradie.get("business_name", ""),
                },
            },
            "quantity": 1,
        }],
        application_fee_amount=fee_cents,
        transfer_data={"destination": tradie["stripe_account_id"]},
        metadata={
            "invoice_id": str(invoice.get("id", "")),
            "tradie_id": str(tradie["id"]),
        },
    )

    sb.table("invoices").update({
        "stripe_payment_link_id": payment_link.id,
        "stripe_payment_link_url": payment_link.url,
    }).eq("id", invoice["id"]).execute()

    logger.info("Payment link created for invoice %s", invoice.get("invoice_number"))
    return payment_link.url


async def handle_payment_succeeded(
    payment_intent_id: str, invoice_id: str
) -> None:
    sb = _get_supabase()

    from datetime import datetime, timezone

    sb.table("invoices").update({
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "stripe_payment_intent_id": payment_intent_id,
    }).eq("id", invoice_id).execute()

    invoice = sb.table("invoices").select(
        "*, tradies!inner(whatsapp_number, business_name)"
    ).eq("id", invoice_id).single().execute()

    if invoice.data:
        from notifications import send_payment_received

        tradie_data = invoice.data.get("tradies", {})
        await send_payment_received(
            tradie_data,
            invoice.data,
            float(invoice.data["total"]),
        )

    logger.info("Payment succeeded for invoice %s", invoice_id)
