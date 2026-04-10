from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field

import httpx
from openai import AsyncOpenAI

from utils import calculate_gst

logger = logging.getLogger("docket.parser")

SYSTEM_PROMPT = """You are an invoice extraction assistant for Australian tradies.
Extract invoice details from the message below.
Return ONLY valid JSON. No explanation. No markdown backticks.

Schema:
{
  "client": string | null,
  "items": [{"description": string, "quantity": number, "unit_price": number, "amount": number}],
  "gst_included": boolean,
  "subtotal": number,
  "gst": number,
  "total": number,
  "confidence": number
}

Rules:
- GST in Australia is always 10%
- If "inc gst" or "incl gst": gst_included=true, back-calculate (subtotal = total/1.1)
- Default gst_included=false (add 10% on top)
- Labour is typically $/hr
- AU trade brands: Reece, Bunnings, Rexel, Blackwoods, Total Tools
- Slang: sparky=electrician, chippy=carpenter, brickie=bricklayer
- If confidence < 0.7, reflect that in the score — do not guess on amounts"""


@dataclass
class LineItem:
    description: str
    quantity: float
    unit_price: float
    amount: float


@dataclass
class ParsedInvoice:
    client: str | None
    items: list[LineItem] = field(default_factory=list)
    gst_included: bool = False
    subtotal: float = 0.0
    gst: float = 0.0
    total: float = 0.0
    confidence: float = 0.0
    raw_json: str = ""


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _parse_response(raw: str) -> ParsedInvoice:
    data = json.loads(raw)
    items = [
        LineItem(
            description=item["description"],
            quantity=item.get("quantity", 1),
            unit_price=item.get("unit_price", 0),
            amount=item.get("amount", 0),
        )
        for item in data.get("items", [])
    ]

    gst_included = data.get("gst_included", False)
    raw_subtotal = float(data.get("subtotal", 0))
    subtotal, gst, total = calculate_gst(
        data.get("total", raw_subtotal) if gst_included else raw_subtotal,
        gst_included,
    )

    return ParsedInvoice(
        client=data.get("client"),
        items=items,
        gst_included=gst_included,
        subtotal=subtotal,
        gst=gst,
        total=total,
        confidence=float(data.get("confidence", 0)),
        raw_json=raw,
    )


async def parse_text_message(text: str, tradie: dict) -> ParsedInvoice:
    client = _get_client()
    user_content = f"Tradie: {tradie.get('business_name', 'Unknown')}\n\nMessage:\n{text}"

    for attempt in range(2):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                max_tokens=1000,
                temperature=0,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
            )
            raw = response.choices[0].message.content or ""
            return _parse_response(raw)
        except json.JSONDecodeError:
            if attempt == 1:
                logger.error("JSON parse failed after retry for text message")
                raise
            logger.warning("JSON parse failed, retrying once")
        except Exception:
            logger.exception("GPT-4o text parsing error")
            raise

    raise RuntimeError("parse_text_message exhausted retries")


async def parse_image_message(media_url: str, tradie: dict) -> ParsedInvoice:
    """Extract invoice from a photo via GPT-4o Vision."""
    client = _get_client()
    user_content = [
        {
            "type": "text",
            "text": f"Tradie: {tradie.get('business_name', 'Unknown')}\n\nExtract invoice from this image.",
        },
        {"type": "image_url", "image_url": {"url": media_url}},
    ]

    for attempt in range(2):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                max_tokens=1000,
                temperature=0,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
            )
            raw = response.choices[0].message.content or ""
            return _parse_response(raw)
        except json.JSONDecodeError:
            if attempt == 1:
                logger.error("JSON parse failed after retry for image message")
                raise
            logger.warning("JSON parse failed on image, retrying")
        except Exception:
            logger.exception("GPT-4o image parsing error")
            raise

    raise RuntimeError("parse_image_message exhausted retries")


async def parse_voice_message(media_url: str, tradie: dict) -> ParsedInvoice:
    """Transcribe voice via Whisper, then parse with GPT-4o."""
    client = _get_client()

    async with httpx.AsyncClient() as http:
        twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        resp = await http.get(media_url, auth=(twilio_sid, twilio_token))
        resp.raise_for_status()
        audio_bytes = resp.content

    transcription = await client.audio.transcriptions.create(
        model="whisper-1",
        file=("voice.ogg", audio_bytes, "audio/ogg"),
    )
    transcript_text = transcription.text
    logger.info("Whisper transcription: %s", transcript_text)

    return await parse_text_message(transcript_text, tradie)
