"""Fee note monetary calculations (Decimal, ROUND_HALF_UP to cents)."""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True, slots=True)
class FeeNoteTotals:
    subtotal: Decimal
    vat_amount: Decimal
    withholding_amount: Decimal
    total: Decimal


def compute_totals(
    amounts: Iterable[Decimal], *, vat_rate: Decimal, withholding_rate: Decimal
) -> FeeNoteTotals:
    """total = subtotal + VAT − IRS withholding (retenção na fonte)."""
    subtotal = money(sum(amounts, Decimal("0")))
    vat = money(subtotal * vat_rate)
    withholding = money(subtotal * withholding_rate)
    return FeeNoteTotals(subtotal, vat, withholding, money(subtotal + vat - withholding))
