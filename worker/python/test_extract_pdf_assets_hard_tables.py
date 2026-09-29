"""Harder clinically relational tables for the table-aware reader (audit F20).

The clozapine regression (test_extract_pdf_assets_table_reading_order.py) wraps
only the first column. Real WA guideline tables also wrap several columns at
once, leave cells empty, and merge a header across columns. Each fixture here
asserts the relationship that matters clinically: a threshold stays in the same
row as its label and its action, and nothing is dropped.
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import extract_pdf_assets as extractor

fitz = extractor.fitz
LINE = 12


def draw_table(page, xs, top, header, rows, merged_header=None):
    """Draw a ruled grid. `rows` is a list of rows; each cell is a list of lines."""

    def rule(y):
        page.draw_line(fitz.Point(xs[0], y), fitz.Point(xs[-1], y), width=0.7)

    y = top
    rule(y - 4)
    if merged_header:
        # One heading spanning every column: no vertical rules through this band.
        page.insert_text(fitz.Point(xs[0] + 3, y + 8), merged_header, fontsize=9)
        y += LINE + 4
        rule(y - 4)
    header_top = y - 4
    for index, heading in enumerate(header):
        page.insert_text(fitz.Point(xs[index] + 3, y + 8), heading, fontsize=9)
    y += LINE + 4
    rule(y - 4)
    for cells in rows:
        row_top = y
        for index, lines in enumerate(cells):
            for offset, line in enumerate(lines):
                page.insert_text(fitz.Point(xs[index] + 3, row_top + 8 + offset * LINE), line, fontsize=8)
        y = row_top + max(1, max(len(cell) for cell in cells)) * LINE + 4
        rule(y - 4)
    for x in xs:
        page.draw_line(fitz.Point(x, header_top), fitz.Point(x, y - 4), width=0.7)
    if merged_header:
        for x in (xs[0], xs[-1]):
            page.draw_line(fitz.Point(x, top - 4), fitz.Point(x, header_top), width=0.7)


def rebuilt_text(build):
    with tempfile.TemporaryDirectory() as directory:
        path = os.path.join(directory, "table.pdf")
        document = fitz.open()
        page = document.new_page(width=595, height=842)
        build(page)
        document.save(path)
        document.close()
        with fitz.open(path) as opened:
            page = opened[0]
            text = extractor.table_aware_page_text(page, extractor.likely_table_candidates(page))
    return re.sub(r"\s+", " ", text or "").strip()


LITHIUM_XS = [40, 150, 270, 430, 555]
LITHIUM_ROWS = [
    (
        ["Below 0.4 mmol/L"],
        ["Check timing:", "12 hours after", "the last dose"],
        ["Review adherence and", "interacting drugs before", "increasing the dose"],
        ["Recheck in 5 to 7 days"],
    ),
    (
        ["Above 1.2 mmol/L"],
        ["Any time"],
        ["Withhold lithium.", "Urgent medical review", "for toxicity"],
        ["Check renal function", "and electrolytes"],
    ),
]


class MultiColumnWrapTests(unittest.TestCase):
    """Several columns wrap at once, so line-major order would splice three cells together."""

    @classmethod
    def setUpClass(cls):
        cls.text = rebuilt_text(
            lambda page: draw_table(page, LITHIUM_XS, 80, ["Level", "Timing", "Action", "Follow-up"], LITHIUM_ROWS)
        )

    def test_each_threshold_keeps_its_own_action(self):
        high = self.text.index("Above 1.2 mmol/L")
        withhold = self.text.index("Withhold lithium.")
        low = self.text.index("Below 0.4 mmol/L")
        review = self.text.index("Review adherence and interacting drugs before increasing the dose")
        self.assertLess(low, review)
        self.assertLess(review, high, "the low-level action must not drift into the high-level row")
        self.assertLess(high, withhold)

    def test_wrapped_cells_read_as_whole_sentences(self):
        self.assertIn("Check timing: 12 hours after the last dose", self.text)
        self.assertIn("Withhold lithium. Urgent medical review for toxicity", self.text)
        self.assertNotRegex(self.text, r"Withhold lithium\.\s*Check renal")


class EmptyCellTests(unittest.TestCase):
    """An empty cell must not pull a neighbouring cell's text into its row."""

    def test_empty_middle_cell_keeps_the_row_aligned(self):
        rows = [
            (["Neutrophils 1.5 to 2.0", "(amber range,", "any week)"], [], ["Twice-weekly FBC", "until back in", "the green range"]),
            (["Neutrophils below 1.5", "(red range)"], ["Stop clozapine", "and seek", "haematology advice"], ["Daily FBC"]),
        ]
        text = rebuilt_text(lambda page: draw_table(page, [40, 200, 360, 555], 80, ["Result", "Action", "Monitoring"], rows))
        amber = text.index("Neutrophils 1.5 to 2.0")
        red = text.index("Neutrophils below 1.5")
        self.assertIn("Neutrophils 1.5 to 2.0 (amber range, any week)", text)
        self.assertIn("Twice-weekly FBC until back in the green range", text)
        self.assertLess(amber, text.index("Twice-weekly FBC"))
        self.assertLess(text.index("Twice-weekly FBC"), red)
        self.assertIn("Stop clozapine and seek haematology advice", text)
        self.assertLess(red, text.index("Stop clozapine"), "the stop instruction belongs to the red row only")


class MergedHeaderTests(unittest.TestCase):
    """A title row merged across every column sits above an ordinary grid."""

    def test_rows_stay_intact_under_a_merged_title(self):
        rows = [
            (["WBC"], ["3.5 or above"], ["3.0 to 3.5:", "repeat twice", "weekly"], ["Below 3.0:", "stop clozapine"]),
            (["Neutrophils"], ["2.0 or above"], ["1.5 to 2.0:", "repeat twice", "weekly"], ["Below 1.5:", "stop clozapine"]),
        ]
        text = rebuilt_text(
            lambda page: draw_table(
                page,
                [40, 170, 300, 430, 555],
                80,
                ["Count (x 10^9/L)", "Green", "Amber", "Red"],
                rows,
                merged_header="Clozapine full blood count ranges",
            )
        )
        self.assertIn("Clozapine full blood count ranges", text)
        wbc, neutrophils = text.index("WBC"), text.index("Neutrophils")
        self.assertLess(wbc, text.index("Below 3.0"))
        self.assertLess(text.index("Below 3.0"), neutrophils, "WBC red range must stay in the WBC row")
        self.assertLess(neutrophils, text.index("Below 1.5"))
        self.assertIn("Below 3.0: stop clozapine", text)
        self.assertIn("1.5 to 2.0: repeat twice weekly", text)


if __name__ == "__main__":
    unittest.main()
