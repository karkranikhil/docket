from datetime import date, datetime

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import (
    calculate_gst,
    format_currency,
    format_date,
    format_phone_display,
    get_gst_quarter,
    validate_abn,
)


class TestValidateABN:
    def test_valid_abn_no_spaces(self):
        assert validate_abn("51824753556") is True

    def test_valid_abn_with_spaces(self):
        assert validate_abn("51 824 753 556") is True

    def test_valid_abn_another(self):
        assert validate_abn("33102417032") is True

    def test_invalid_abn_wrong_checksum(self):
        assert validate_abn("12345678901") is False

    def test_invalid_abn_too_short(self):
        assert validate_abn("1234567890") is False

    def test_invalid_abn_too_long(self):
        assert validate_abn("123456789012") is False

    def test_invalid_abn_letters(self):
        assert validate_abn("5182475355A") is False

    def test_invalid_abn_empty(self):
        assert validate_abn("") is False

    def test_valid_abn_ato_example(self):
        # ATO's published example ABN
        assert validate_abn("53004085616") is True

    def test_all_zeros(self):
        assert validate_abn("00000000000") is False


class TestFormatCurrency:
    def test_basic(self):
        assert format_currency(1234.50) == "$1,234.50"

    def test_zero(self):
        assert format_currency(0) == "$0.00"

    def test_large(self):
        assert format_currency(123456.78) == "$123,456.78"

    def test_small(self):
        assert format_currency(0.50) == "$0.50"

    def test_no_cents(self):
        assert format_currency(100) == "$100.00"


class TestFormatDate:
    def test_date(self):
        assert format_date(date(2025, 3, 15)) == "15/03/2025"

    def test_datetime(self):
        assert format_date(datetime(2025, 12, 1, 10, 30)) == "01/12/2025"

    def test_single_digit_day(self):
        assert format_date(date(2025, 1, 5)) == "05/01/2025"


class TestFormatPhoneDisplay:
    def test_standard_au(self):
        assert format_phone_display("+61412345678") == "0412 345 678"

    def test_non_au(self):
        assert format_phone_display("+15551234567") == "+15551234567"

    def test_landline(self):
        assert format_phone_display("+61298765432") == "0298 765 432"


class TestGetGSTQuarter:
    def test_q1_jul(self):
        start, end = get_gst_quarter(date(2025, 7, 15))
        assert start == date(2025, 7, 1)
        assert end == date(2025, 9, 30)

    def test_q2_oct(self):
        start, end = get_gst_quarter(date(2025, 11, 1))
        assert start == date(2025, 10, 1)
        assert end == date(2025, 12, 31)

    def test_q3_jan(self):
        start, end = get_gst_quarter(date(2026, 2, 28))
        assert start == date(2026, 1, 1)
        assert end == date(2026, 3, 31)

    def test_q4_apr(self):
        start, end = get_gst_quarter(date(2025, 5, 10))
        assert start == date(2025, 4, 1)
        assert end == date(2025, 6, 30)


class TestCalculateGST:
    def test_gst_exclusive(self):
        subtotal, gst, total = calculate_gst(100.0, included=False)
        assert subtotal == 100.0
        assert gst == 10.0
        assert total == 110.0

    def test_gst_inclusive(self):
        subtotal, gst, total = calculate_gst(110.0, included=True)
        assert subtotal == 100.0
        assert gst == 10.0
        assert total == 110.0

    def test_gst_exclusive_decimal(self):
        subtotal, gst, total = calculate_gst(255.0, included=False)
        assert subtotal == 255.0
        assert gst == 25.5
        assert total == 280.5

    def test_gst_inclusive_decimal(self):
        subtotal, gst, total = calculate_gst(280.50, included=True)
        assert subtotal == 255.0
        assert gst == 25.5
        assert total == 280.5

    def test_gst_zero(self):
        subtotal, gst, total = calculate_gst(0.0, included=False)
        assert subtotal == 0.0
        assert gst == 0.0
        assert total == 0.0

    def test_gst_inclusive_odd_amount(self):
        subtotal, gst, total = calculate_gst(99.99, included=True)
        assert total == 99.99
        assert abs(subtotal + gst - total) < 0.01
