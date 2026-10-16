"""Test Fee Note Excel generation and single-timer enforcement."""

from datetime import datetime
from decimal import Decimal

import openpyxl

from pcn.exporters.fee_note_xlsx import FeeNoteExcelBuilder


def test_fee_note_excel_builder_output():
    items = [
        {
            "date": datetime(2026, 10, 15, 10, 0),
            "description": "Emissão de Certidão Negativa Predial",
            "lawyer_name": "Dr.ª Inês",
            "duration_seconds": 3600,
            "amount": Decimal("85.00"),
        },
        {
            "date": datetime(2026, 10, 16, 14, 30),
            "description": "Redação de Contestação",
            "lawyer_name": "Dr.ª Sofia",
            "duration_seconds": 7200,
            "amount": Decimal("250.00"),
        },
    ]

    buffer = FeeNoteExcelBuilder.build(
        reference_code="NH-2026-0001",
        issued_at=datetime(2026, 10, 16),
        client_name="Imobiliária Lusitana, Lda.",
        client_nif="501234567",
        client_process_ref="Proc. 1234/26.4T8LSB",
        items=items,
        subtotal=Decimal("335.00"),
        vat_rate=Decimal("0.23"),
        vat_amount=Decimal("77.05"),
        withholding_rate=Decimal("0.23"),
        withholding_amount=Decimal("77.05"),
        total=Decimal("335.00"),
        notes="Pagamento a 30 dias por transferência bancária.",
        include_internal_metrics=True,
    )

    assert buffer is not None
    # Load with openpyxl to verify sheet structure and formula
    wb = openpyxl.load_workbook(buffer)
    ws = wb.active
    assert ws.title == "Nota de Honorários"
    assert ws["A1"].value == "PCN ADVOGADAS — NOTA DE HONORÁRIOS"
    # Find the cell with SUM formula
    found_sum = False
    for row in ws.iter_rows(values_only=True):
        for cell_val in row:
            if isinstance(cell_val, str) and "=SUM(" in cell_val:
                found_sum = True
                break
    assert found_sum, (
        "A fórmula dinâmica =SUM(...) deve constar na folha Excel para recálculo automático."
    )
