"""Test suite for GPT-4o invoice parser.

These tests require OPENAI_API_KEY to be set.
Run with: pytest tests/test_parser.py -v
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from parser import parse_text_message

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set",
)

TRADIE_PLUMBER = {
    "id": "test-tradie-1",
    "business_name": "Dave's Plumbing",
    "abn": "51824753556",
}

TRADIE_ELECTRICIAN = {
    "id": "test-tradie-2",
    "business_name": "Sparky Solutions",
    "abn": "33102417032",
}


@pytest.mark.asyncio
async def test_simple_labour_and_parts():
    result = await parse_text_message(
        "Labour 2hrs $80/hr, mixer tap $95, for Mick Smith",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 0
    assert result.gst == round(result.subtotal * 0.10, 2)
    assert result.total == round(result.subtotal + result.gst, 2)
    assert result.client == "Mick Smith"


@pytest.mark.asyncio
async def test_gst_inclusive():
    result = await parse_text_message(
        "Hot water system install $2200 inc GST for Karen",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.gst_included is True
    assert result.total == 2200.0 or abs(result.total - 2200.0) < 1
    assert abs(result.subtotal - 2000.0) < 1


@pytest.mark.asyncio
async def test_gst_exclusive():
    result = await parse_text_message(
        "Rewired kitchen $450 plus GST for Tom Brown",
        TRADIE_ELECTRICIAN,
    )
    assert result.confidence >= 0.7
    assert result.gst_included is False
    assert abs(result.subtotal - 450.0) < 1


@pytest.mark.asyncio
async def test_voice_style_informal():
    result = await parse_text_message(
        "yeah just did three hours at the johnsons fixing their dunny, eighty bucks an hour plus a new cistern for one fifty",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 0


@pytest.mark.asyncio
async def test_trade_slang_sparky():
    result = await parse_text_message(
        "sparky work at 42 Smith St, replaced 3 power points $45 each plus 2hrs labour $90/hr for Sarah",
        TRADIE_ELECTRICIAN,
    )
    assert result.confidence >= 0.7
    assert len(result.items) >= 2


@pytest.mark.asyncio
async def test_trade_slang_chippy():
    result = await parse_text_message(
        "chippy job for the Nguyens, built new deck frame 8hrs at $75/hr, timber from Bunnings $1200",
        {"id": "test-3", "business_name": "Mates Carpentry"},
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 0


@pytest.mark.asyncio
async def test_photo_docket_description():
    result = await parse_text_message(
        "From my paper docket: Client Jane Doe, fixed leaking shower $180 labour, silicone $12, new shower head $89",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.client is not None


@pytest.mark.asyncio
async def test_missing_client_name():
    result = await parse_text_message(
        "Replaced hot water system, labour 4hrs at $85/hr, Rheem system $1800",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 0


@pytest.mark.asyncio
async def test_ambiguous_amounts():
    result = await parse_text_message(
        "did some work today about 200 bucks worth",
        TRADIE_PLUMBER,
    )
    assert result.subtotal > 0


@pytest.mark.asyncio
async def test_multiline_job():
    result = await parse_text_message(
        "Job for Barry White\nRoughIn plumbing 6hrs $90/hr\nCopper pipe 15m $8/m\nFittings $120\nSolder and flux $35",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert len(result.items) >= 3


@pytest.mark.asyncio
async def test_just_labour():
    result = await parse_text_message(
        "4 hours labour at $85/hr for Jim at 15 Oak Rd",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert abs(result.subtotal - 340.0) < 5


@pytest.mark.asyncio
async def test_just_parts():
    result = await parse_text_message(
        "Parts for Lisa: 2x basin taps $75 each, 1x shower mixer $220, silicon $15 from Reece",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert len(result.items) >= 2


@pytest.mark.asyncio
async def test_large_commercial_job():
    result = await parse_text_message(
        "Commercial fit out for ABC Constructions, 3 days labour $750/day, materials Rexel $4500, crane hire $800",
        TRADIE_ELECTRICIAN,
    )
    assert result.confidence >= 0.7
    assert result.total > 5000


@pytest.mark.asyncio
async def test_colloquial_voice_transcription():
    result = await parse_text_message(
        "mate just finished at davo's place fixed his hot water took me about two and a half hours eighty five bucks an hour and the part was one forty from reece",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 0


@pytest.mark.asyncio
async def test_brickie_slang():
    result = await parse_text_message(
        "brickie job at the Patels, laid 500 bricks at $1.80 each plus 2 bags mortar $35 each",
        {"id": "test-4", "business_name": "Solid Brickwork"},
    )
    assert result.confidence >= 0.7
    assert result.subtotal >= 900


@pytest.mark.asyncio
async def test_incl_gst_variation():
    result = await parse_text_message(
        "Bathroom reno for Mark, total $5500 incl gst",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.gst_included is True
    assert abs(result.total - 5500) < 1


@pytest.mark.asyncio
async def test_multiple_rates():
    result = await parse_text_message(
        "For Helen: apprentice 4hrs $45/hr, my labour 4hrs $90/hr, switchboard parts $380",
        TRADIE_ELECTRICIAN,
    )
    assert result.confidence >= 0.7
    assert len(result.items) >= 3


@pytest.mark.asyncio
async def test_gst_calculation_accuracy():
    result = await parse_text_message(
        "Labour $500 for Chris at 8 George St",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.gst == round(result.subtotal * 0.10, 2)
    assert result.total == round(result.subtotal + result.gst, 2)


@pytest.mark.asyncio
async def test_bunnings_receipt():
    result = await parse_text_message(
        "Bunnings run for the Henderson job: 4 sheets plasterboard $28 each, box of screws $18, cornice adhesive $22, delivery $45",
        {"id": "test-5", "business_name": "Pro Plastering"},
    )
    assert result.confidence >= 0.7
    assert len(result.items) >= 3


@pytest.mark.asyncio
async def test_emergency_callout():
    result = await parse_text_message(
        "Emergency callout to fix burst pipe at 2am for Mrs Chen, callout fee $180 plus 1.5hrs labour $95/hr plus copper fittings $65",
        TRADIE_PLUMBER,
    )
    assert result.confidence >= 0.7
    assert result.subtotal > 300
    assert result.client is not None
