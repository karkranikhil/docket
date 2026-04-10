from __future__ import annotations

from datetime import date, datetime


ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]


def validate_abn(abn: str) -> bool:
    """Full 11-digit ABN checksum validation per ATO spec."""
    digits = abn.replace(" ", "")
    if len(digits) != 11 or not digits.isdigit():
        return False
    nums = [int(d) for d in digits]
    nums[0] -= 1
    total = sum(w * n for w, n in zip(ABN_WEIGHTS, nums))
    return total % 89 == 0


def format_currency(amount: float) -> str:
    """Format as AUD: $1,234.50"""
    return f"${amount:,.2f}"


def format_date(dt: datetime | date) -> str:
    """Format as DD/MM/YYYY (Australian)."""
    return dt.strftime("%d/%m/%Y")


def format_phone_display(e164: str) -> str:
    """Convert +61412345678 to 0412 345 678."""
    if not e164.startswith("+61"):
        return e164
    local = "0" + e164[3:]
    if len(local) == 10:
        return f"{local[:4]} {local[4:7]} {local[7:]}"
    return local


def get_gst_quarter(dt: datetime | date) -> tuple[date, date]:
    """Return (start, end) dates for the Australian BAS quarter containing dt.

    ATO quarters: Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun.
    """
    month = dt.month
    year = dt.year
    if month in (7, 8, 9):
        return date(year, 7, 1), date(year, 9, 30)
    elif month in (10, 11, 12):
        return date(year, 10, 1), date(year, 12, 31)
    elif month in (1, 2, 3):
        return date(year, 1, 1), date(year, 3, 31)
    else:
        return date(year, 4, 1), date(year, 6, 30)


def calculate_gst(
    amount: float, included: bool
) -> tuple[float, float, float]:
    """Calculate GST components.

    Returns (subtotal, gst, total).
    If included=True, the amount is GST-inclusive so we back-calculate.
    If included=False, GST is added on top.
    """
    if included:
        total = round(amount, 2)
        subtotal = round(total / 1.1, 2)
        gst = round(total - subtotal, 2)
    else:
        subtotal = round(amount, 2)
        gst = round(subtotal * 0.10, 2)
        total = round(subtotal + gst, 2)
    return subtotal, gst, total
