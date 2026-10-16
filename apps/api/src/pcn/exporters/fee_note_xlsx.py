"""Excel generator for PCN Advogadas Fee Notes (Notas de Honorários / Conta de Honorários).

Implements Builder Pattern for styled .xlsx generation using openpyxl in memory (BytesIO).
Applies PCN brand colors: #92006F (Purple), #5E0047 (Deep Violet), #D4AF37 (Gold), #F7F3EB (Warm Beige).
"""

import io
import os
from datetime import datetime
from decimal import Decimal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


class FeeNoteExcelBuilder:
    # Cores Oficiais PCN Advogadas
    PURPLE = "92006F"
    DEEP_VIOLET = "5E0047"
    GOLD = "D4AF37"
    BEIGE = "F7F3EB"
    WHITE = "FFFFFF"
    DARK_TEXT = "2B2B2B"
    BORDER_GRAY = "E0DCD3"

    @staticmethod
    def _format_seconds(seconds: int) -> str:
        hours, rem = divmod(seconds, 3600)
        minutes, _ = divmod(rem, 60)
        return f"{hours:02d}h {minutes:02d}m"

    @classmethod
    def build(
        cls,
        *,
        reference_code: str,
        issued_at: datetime,
        client_name: str,
        client_nif: str | None,
        client_process_ref: str | None,
        items: list[
            dict
        ],  # list of item dicts: {date, description, lawyer_name, duration_seconds, amount}
        subtotal: Decimal,
        vat_rate: Decimal,
        vat_amount: Decimal,
        withholding_rate: Decimal,
        withholding_amount: Decimal,
        total: Decimal,
        notes: str | None = None,
        include_internal_metrics: bool = False,
        logo_path: str | None = None,
    ) -> io.BytesIO:
        wb = Workbook()
        ws = wb.active
        ws.title = "Nota de Honorários"
        ws.views.sheetView[0].showGridLines = True

        max_col = 5 if include_internal_metrics else 3
        last_col = get_column_letter(max_col)

        # ── Estilos ──
        font_header_title = Font(name="Calibri", size=15, bold=True, color=cls.WHITE)
        font_header_sub = Font(name="Calibri", size=10, italic=True, color=cls.BEIGE)
        font_section = Font(name="Calibri", size=11, bold=True, color=cls.PURPLE)
        font_label = Font(name="Calibri", size=10, bold=True, color=cls.DARK_TEXT)
        font_regular = Font(name="Calibri", size=10, color=cls.DARK_TEXT)
        font_th = Font(name="Calibri", size=10, bold=True, color=cls.WHITE)
        font_total_bold = Font(name="Calibri", size=11, bold=True, color=cls.WHITE)

        fill_purple = PatternFill(start_color=cls.PURPLE, end_color=cls.PURPLE, fill_type="solid")
        fill_violet = PatternFill(
            start_color=cls.DEEP_VIOLET, end_color=cls.DEEP_VIOLET, fill_type="solid"
        )
        fill_beige = PatternFill(start_color=cls.BEIGE, end_color=cls.BEIGE, fill_type="solid")
        fill_white = PatternFill(start_color=cls.WHITE, end_color=cls.WHITE, fill_type="solid")

        gold_thin = Side(border_style="thin", color=cls.GOLD)
        gold_medium = Side(border_style="medium", color=cls.GOLD)
        gray_thin = Side(border_style="thin", color=cls.BORDER_GRAY)

        border_card = Border(left=gold_thin, right=gold_thin, top=gold_thin, bottom=gold_thin)
        border_row = Border(left=gray_thin, right=gray_thin, top=gray_thin, bottom=gray_thin)
        border_th = Border(left=gold_thin, right=gold_thin, top=gold_medium, bottom=gold_medium)

        # ── 1. Cabeçalho Institucional ──
        ws.merge_cells(f"A1:{last_col}1")
        ws.merge_cells(f"A2:{last_col}2")

        c1 = ws["A1"]
        c1.value = "PCN ADVOGADAS — NOTA DE HONORÁRIOS"
        c1.font = font_header_title
        c1.fill = fill_purple
        c1.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 36

        c2 = ws["A2"]
        c2.value = f"Ref.ª {reference_code} | Data de Emissão: {issued_at.strftime('%d/%m/%Y')}"
        c2.font = font_header_sub
        c2.fill = fill_violet
        c2.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 20

        # Inserir Logótipo se existir
        if logo_path and os.path.exists(logo_path):
            try:
                from openpyxl.drawing.image import Image as OpenpyxlImage

                img = OpenpyxlImage(logo_path)
                img.height = 42
                img.width = 110
                ws.add_image(img, "A1")
            except Exception:
                pass

        # ── 2. Identificação do Cliente ──
        ws.row_dimensions[4].height = 20
        ws["A4"] = "DADOS DO CLIENTE E PROCESSO"
        ws["A4"].font = font_section

        client_data = [
            ("Cliente:", client_name),
            ("NIF:", client_nif or "—"),
            ("Processo / Referência:", client_process_ref or "Assessoria Jurídica Geral"),
        ]

        curr_row = 5
        for label, val in client_data:
            ws.row_dimensions[curr_row].height = 19
            ws[f"A{curr_row}"] = label
            ws[f"A{curr_row}"].font = font_label
            ws[f"A{curr_row}"].fill = fill_beige
            ws[f"A{curr_row}"].alignment = Alignment(horizontal="left", vertical="center")

            ws.merge_cells(f"B{curr_row}:{last_col}{curr_row}")
            ws[f"B{curr_row}"] = val
            ws[f"B{curr_row}"].font = font_regular
            ws[f"B{curr_row}"].fill = fill_beige
            ws[f"B{curr_row}"].alignment = Alignment(horizontal="left", vertical="center")

            for c_idx in range(1, max_col + 1):
                ws.cell(row=curr_row, column=c_idx).border = border_card
            curr_row += 1

        curr_row += 1  # Espaço

        # ── 3. Cabeçalho da Tabela de Atos / Tarefas ──
        if include_internal_metrics:
            headers = [
                "Data",
                "Descrição do Ato / Tarefa Realizada",
                "Advogada",
                "Tempo",
                "Honorários (€)",
            ]
        else:
            headers = ["Data", "Descrição do Ato / Tarefa Realizada", "Honorários (€)"]

        ws.row_dimensions[curr_row].height = 24
        for c_idx, h_text in enumerate(headers, start=1):
            cell = ws.cell(row=curr_row, column=c_idx, value=h_text)
            cell.font = font_th
            cell.fill = fill_purple
            cell.border = border_th
            cell.alignment = Alignment(
                horizontal="center" if c_idx != 2 else "left",
                vertical="center",
            )

        start_data_row = curr_row + 1
        curr_row += 1

        # ── 4. Linhas de Tarefas Realizadas ──
        for idx, item in enumerate(items):
            ws.row_dimensions[curr_row].height = 22
            row_fill = fill_beige if idx % 2 == 1 else fill_white
            d_str = (
                item["date"].strftime("%d/%m/%Y")
                if isinstance(item["date"], datetime)
                else str(item["date"])
            )

            if include_internal_metrics:
                row_vals = [
                    d_str,
                    item["description"],
                    item.get("lawyer_name") or "—",
                    cls._format_seconds(item.get("duration_seconds", 0)),
                    float(item["amount"]),
                ]
            else:
                row_vals = [
                    d_str,
                    item["description"],
                    float(item["amount"]),
                ]

            for c_idx, val in enumerate(row_vals, start=1):
                cell = ws.cell(row=curr_row, column=c_idx, value=val)
                cell.font = font_regular
                cell.fill = row_fill
                cell.border = border_row
                if c_idx == 1:
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif c_idx == 2:
                    cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                elif c_idx == max_col:
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                    cell.number_format = '#,##0.00 "€"'
                else:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

            curr_row += 1

        end_data_row = curr_row - 1

        # ── 5. Totais e Quadro Fiscal (IVA + Retenção na Fonte) ──
        # Subtotal com fórmula nativa =SUM()
        ws.row_dimensions[curr_row].height = 22
        sub_merge = get_column_letter(max_col - 1)
        ws.merge_cells(f"A{curr_row}:{sub_merge}{curr_row}")
        ws[f"A{curr_row}"] = "Subtotal (Honorários):"
        ws[f"A{curr_row}"].font = font_label
        ws[f"A{curr_row}"].alignment = Alignment(horizontal="right", vertical="center")

        sub_cell = ws.cell(row=curr_row, column=max_col)
        sub_cell.value = (
            f"=SUM({last_col}{start_data_row}:{last_col}{end_data_row})"
            if end_data_row >= start_data_row
            else 0.0
        )
        sub_cell.font = font_label
        sub_cell.alignment = Alignment(horizontal="right", vertical="center")
        sub_cell.number_format = '#,##0.00 "€"'
        curr_row += 1

        # IVA
        ws.row_dimensions[curr_row].height = 20
        ws.merge_cells(f"A{curr_row}:{sub_merge}{curr_row}")
        vat_pct = int(vat_rate * 100)
        ws[f"A{curr_row}"] = f"IVA ({vat_pct}%):"
        ws[f"A{curr_row}"].font = font_regular
        ws[f"A{curr_row}"].alignment = Alignment(horizontal="right", vertical="center")
        vat_cell = ws.cell(row=curr_row, column=max_col)
        vat_cell.value = float(vat_amount)
        vat_cell.font = font_regular
        vat_cell.alignment = Alignment(horizontal="right", vertical="center")
        vat_cell.number_format = '#,##0.00 "€"'
        curr_row += 1

        # Retenção IRS (se aplicável)
        if withholding_rate > 0:
            ws.row_dimensions[curr_row].height = 20
            ws.merge_cells(f"A{curr_row}:{sub_merge}{curr_row}")
            ret_pct = int(withholding_rate * 100)
            ws[f"A{curr_row}"] = f"Retenção na Fonte IRS ({ret_pct}%):"
            ws[f"A{curr_row}"].font = font_regular
            ws[f"A{curr_row}"].alignment = Alignment(horizontal="right", vertical="center")
            ret_cell = ws.cell(row=curr_row, column=max_col)
            ret_cell.value = -float(withholding_amount)
            ret_cell.font = font_regular
            ret_cell.alignment = Alignment(horizontal="right", vertical="center")
            ret_cell.number_format = '#,##0.00 "€"'
            curr_row += 1

        # Total Líquido / Final da Nota
        ws.row_dimensions[curr_row].height = 26
        ws.merge_cells(f"A{curr_row}:{sub_merge}{curr_row}")
        ws[f"A{curr_row}"] = "TOTAL A PAGAR:"
        ws[f"A{curr_row}"].font = font_total_bold
        ws[f"A{curr_row}"].fill = fill_violet
        ws[f"A{curr_row}"].alignment = Alignment(horizontal="right", vertical="center")

        total_cell = ws.cell(row=curr_row, column=max_col)
        total_cell.value = float(total)
        total_cell.font = font_total_bold
        total_cell.fill = fill_purple
        total_cell.alignment = Alignment(horizontal="right", vertical="center")
        total_cell.number_format = '#,##0.00 "€"'
        curr_row += 1

        # ── 6. Observações ──
        if notes:
            curr_row += 1
            ws[f"A{curr_row}"] = "Condições e Observações:"
            ws[f"A{curr_row}"].font = font_section
            curr_row += 1
            ws.merge_cells(f"A{curr_row}:{last_col}{curr_row}")
            ws[f"A{curr_row}"] = notes
            ws[f"A{curr_row}"].font = font_regular

        # ── 7. Largura das Colunas ──
        if include_internal_metrics:
            col_widths = {1: 14, 2: 56, 3: 20, 4: 16, 5: 18}
        else:
            col_widths = {1: 15, 2: 70, 3: 20}

        for c_idx, width in col_widths.items():
            ws.column_dimensions[get_column_letter(c_idx)].width = width

        # Configuração de Impressão A4
        ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
        ws.sheet_properties.pageSetUpPr.fitToPage = True

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
