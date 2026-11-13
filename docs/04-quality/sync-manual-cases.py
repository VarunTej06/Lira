"""Copies sections of manual-test-checklist.md into Lira-manual-test-cases.xlsx as test cases.

Run from the repository root, with the workbook closed in Excel:

    python docs/04-quality/sync-manual-cases.py A25 A26

Each "- [ ] step. Expect: result." line of a section becomes one row (ID A25-01, A25-02 ...), marked "Not run".
A section that is already in the workbook is skipped, so running it again is safe. Rows that are already there,
including the results a tester recorded, are never changed. Needs Python with openpyxl (pip install openpyxl).
"""
import re
import sys
from copy import copy

import openpyxl
from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.worksheet.cell_range import MultiCellRange

MD = 'docs/04-quality/manual-test-checklist.md'
XLSX = 'docs/04-quality/Lira-manual-test-cases.xlsx'
THEMES = 'Dark + Sorrel + Fawn'
HALF_CIRCLE = '◐'  # marks a section to test in all three themes


def section(md, sid):
    """The title of a section, whether it is tested in every theme, and its (step, expected) pairs."""
    m = re.search(r'^### %s\. (.+)$' % re.escape(sid), md, re.M)
    if not m:
        raise SystemExit('no section %s in the checklist' % sid)
    themed = HALF_CIRCLE in m.group(1)
    title = re.sub(r'\s*\(\d+ \w+ \d{4}\)', '', m.group(1).replace(HALF_CIRCLE, '')).strip()
    body = md[m.end():]
    end = re.search(r'^(###? |---)', body, re.M)
    body = body[:end.start()] if end else body
    cases = []
    for line in re.findall(r'^- \[ \] (.+)$', body, re.M):
        step, _, expected = line.replace('**', '').replace('`', '').partition(' Expect: ')
        cases.append((step.strip(), expected.strip().rstrip('.') or 'Works as described in the step; no red errors in the console'))
    return title, themed, cases


def style(dst, src):
    dst.font, dst.border, dst.fill, dst.alignment, dst.number_format = copy(src.font), copy(src.border), copy(src.fill), copy(src.alignment), src.number_format


def main(ids):
    md = open(MD, encoding='utf-8').read()
    wb = openpyxl.load_workbook(XLSX)
    ws, summary = wb['Test cases'], wb['Summary']
    first_last = ws.max_row
    have = {str(c.value).split('-')[0] for c in ws['A'][1:] if c.value}

    for sid in ids:
        if sid in have:
            print(sid, 'is already in the workbook')
            continue
        title, themed, cases = section(md, sid)
        template = ws[ws.max_row]
        for i, (step, expected) in enumerate(cases, 1):
            row = ws.max_row + 1
            for col, value in enumerate(['%s-%02d' % (sid, i), title, step, expected, THEMES if themed else None, 'Not run', None, None, None], 1):
                style(ws.cell(row=row, column=col, value=value), template[col - 1])
        # one more line in the per-screen table of the Summary sheet
        last = summary.max_row
        for col in range(1, summary.max_column + 1):
            src, dst = summary.cell(row=last, column=col), summary.cell(row=last + 1, column=col)
            dst.value = title if col == 1 else (src.value.replace('A%d' % last, 'A%d' % (last + 1)) if isinstance(src.value, str) else src.value)
            style(dst, src)
        print(sid, title, len(cases), 'cases')

    last = ws.max_row
    if last != first_last:
        # the status dropdown, its colours, and the counting formulas must cover the new rows
        old, new = str(first_last), str(last)
        for dv in ws.data_validations.dataValidation:
            dv.sqref = MultiCellRange(str(dv.sqref).replace(old, new))
        rules = ConditionalFormattingList()
        for cf in ws.conditional_formatting:
            for rule in cf.rules:
                rules.add(str(cf.sqref).replace(old, new), rule)
        ws.conditional_formatting = rules
        if ws.auto_filter.ref:
            ws.auto_filter.ref = ws.auto_filter.ref.replace(old, new)
        for row in summary.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and '$' + old in cell.value:
                    cell.value = cell.value.replace('$' + old, '$' + new)
        wb.save(XLSX)
    print('rows', first_last, '->', last)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
