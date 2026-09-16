"""Regression: multi-line table cells must not interleave across columns.

Failing stage (pre-fix): page text came straight from
`page.get_text("text", sort=True)`, which orders text LINES by (y, x). A table
whose cells wrap onto several lines therefore reads straight ACROSS the columns,
so a figure in column one lands mid-sentence in column three.

Observed in production on 2026-09-16, in a WA clozapine haematological table
retrieved by the live public search. The served passage read:

    "Neutropenia Requires medical review. Stop clozapine. Contact
     WBC < 1.5 x 10 9/L. Flu-like symptoms such 3.2% haematologist ..."

binding the withhold threshold to the word "Contact" rather than to
"Neutropenia". Answer verification correctly refused to state a clozapine
threshold from that text, which is why four clozapine eval cases generated an
answer and then discarded it.

Fix stage: extract_pdf_assets.table_aware_page_text replaces detected grid
regions with the cell-by-cell rendering find_tables() already produces, leaving
surrounding prose in normal reading order.
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

# Shaped like the real Rockingham Peel clozapine table: three columns, and a
# first column whose cell wraps over several lines. The wrap is what breaks
# line-major ordering, so a single-line-cell table would not reproduce this.
HEADER = ["Side effects/Signs and symptoms", "Rate", "Recommended action"]
ROWS = [
    (
        [
            "Neutropenia",
            "WBC < 1.5 x 10 9/L. Flu-like symptoms such",
            "as sore throat and fever may be present.",
            "(This is most common within the first 18",
            "weeks but may uncommonly occur after",
            "this maximal risk period).",
        ],
        ["3.2%"],
        [
            "Requires medical review. Stop clozapine. Contact",
            "haematologist at ClopineCentral or clozapine",
            "patient monitoring centre if further advice",
            "required. Re-introduction of clozapine should only",
            "occur with haematologist support.",
        ],
    ),
    (
        [
            "Agranulocytosis",
            "WBC < 0.5 x 10 9/L. Flu-like symptoms such",
            "as sore throat and fever may be present.",
        ],
        ["0.8%"],
        [
            "Requires medical review. Stop clozapine.",
            "Contact haematologist at ClopineCentral or",
            "clozapine patient monitoring centre.",
        ],
    ),
]

COLUMN_X = [40, 250, 310, 555]
LINE_HEIGHT = 13
# The exact interleaving signature seen in production: the action text from
# column three wedged between the condition and its threshold.
INTERLEAVED = re.compile(r"Stop clozapine\.\s*Contact\s*WBC < 1\.5")


def build_table_pdf(path):
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    y = 60

    def rule(at):
        page.draw_line(fitz.Point(COLUMN_X[0], at), fitz.Point(COLUMN_X[-1], at), width=0.7)

    rule(y - 4)
    for index, heading in enumerate(HEADER):
        page.insert_text(fitz.Point(COLUMN_X[index] + 3, y + 8), heading, fontsize=9)
    y += LINE_HEIGHT + 4
    rule(y - 4)

    for cells in ROWS:
        top = y
        for index, lines in enumerate(cells):
            line_y = top
            for line in lines:
                page.insert_text(fitz.Point(COLUMN_X[index] + 3, line_y + 8), line, fontsize=9)
                line_y += LINE_HEIGHT
        y = top + max(len(cell) for cell in cells) * LINE_HEIGHT + 4
        rule(y - 4)

    for x in COLUMN_X:
        page.draw_line(fitz.Point(x, 56), fitz.Point(x, y - 4), width=0.7)

    document.save(path)
    document.close()


def flatten(value):
    return re.sub(r"\s+", " ", value or "").strip()


class TableReadingOrderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._directory = tempfile.TemporaryDirectory()
        cls.pdf_path = os.path.join(cls._directory.name, "clozapine-table.pdf")
        build_table_pdf(cls.pdf_path)

    @classmethod
    def tearDownClass(cls):
        cls._directory.cleanup()

    def page(self, document):
        return document[0]

    def test_raw_sorted_text_reproduces_the_interleaving(self):
        """Pin the defect itself, so a PyMuPDF change that fixes it upstream is visible."""
        with fitz.open(self.pdf_path) as document:
            raw = flatten(self.page(document).get_text("text", sort=True))
        self.assertRegex(raw, INTERLEAVED)

    def test_table_aware_text_keeps_each_cell_intact(self):
        with fitz.open(self.pdf_path) as document:
            page = self.page(document)
            rebuilt = flatten(extractor.table_aware_page_text(page, extractor.likely_table_candidates(page)))

        # The defect is gone.
        self.assertNotRegex(rebuilt, INTERLEAVED)
        # The threshold now sits with the condition it qualifies...
        self.assertRegex(rebuilt, r"Neutropenia WBC < 1\.5 x 10 9/L")
        self.assertRegex(rebuilt, r"Agranulocytosis WBC < 0\.5 x 10 9/L")
        # ...and the action is intact rather than shredded across the row.
        self.assertIn("Requires medical review. Stop clozapine. Contact haematologist", rebuilt)
        # Nothing is silently dropped.
        self.assertIn("3.2%", rebuilt)
        self.assertIn("0.8%", rebuilt)

    def test_pages_without_a_detected_grid_are_left_alone(self):
        with fitz.open() as document:
            page = document.new_page(width=595, height=842)
            page.insert_text(fitz.Point(40, 60), "Plain prose with no table at all.", fontsize=11)
            raw = page.get_text("text", sort=True)
            self.assertEqual(extractor.table_aware_page_text(page, []), raw)
            self.assertEqual(extractor.table_aware_page_text(page, extractor.likely_table_candidates(page)), raw)

    def test_retention_guard_keeps_raw_text_when_detection_would_swallow_the_page(self):
        """A misdetected grid must never trade a populated page for a sparse one."""
        with fitz.open(self.pdf_path) as document:
            page = self.page(document)
            raw = page.get_text("text", sort=True)
            swallowing = [
                {
                    "rect": fitz.Rect(page.rect),
                    "extraction_method": "pymupdf_find_tables",
                    "accessible_table_markdown": "| x |",
                }
            ]
            self.assertEqual(extractor.table_aware_page_text(page, swallowing), raw)

    def test_non_grid_candidates_are_ignored(self):
        """Heuristic text-block candidates carry no true cell structure, so they must not rewrite text."""
        with fitz.open(self.pdf_path) as document:
            page = self.page(document)
            raw = page.get_text("text", sort=True)
            heuristic = [
                {
                    "rect": fitz.Rect(page.rect),
                    "extraction_method": "text_block_heuristic",
                    "accessible_table_markdown": "| x |",
                }
            ]
            self.assertEqual(extractor.table_aware_page_text(page, heuristic), raw)


class OcrDecisionIndependenceTests(unittest.TestCase):
    """The table-aware rewrite must not change whether a page is OCR'd.

    Raised as P1 in review of PR #2810. `should_ocr_page` carries hard character
    thresholds (40 always, and 220 on image-dominant pages), so passing it the
    rebuilt text lets markdown syntax move a page across a threshold. The review
    predicted a page SKIPPING needed OCR; measured on synthetic image-dominant
    grids the rebuilt text is shorter and the error runs the other way, causing
    needless OCR. Both directions are the same defect: an OCR decision changed by
    a chunking fix. The decision is therefore taken on raw embedded text.
    """

    def build_image_dominant_grid(self, path, columns=2, rows=3, cell="Repeat FBC weekly"):
        document = fitz.open()
        page = document.new_page(width=560, height=400)
        pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 560, 215))
        pixmap.clear_with(200)
        page.insert_image(fitz.Rect(0, 0, 560, 215), pixmap=pixmap)

        xs = [20 + index * (520 // columns) for index in range(columns + 1)]
        ys = [240 + index * 18 for index in range(rows + 1)]
        for row in range(rows):
            for column in range(columns):
                page.insert_text(fitz.Point(xs[column] + 3, ys[row] + 11), cell, fontsize=7)
        for y in ys:
            page.draw_line(fitz.Point(xs[0], y), fitz.Point(xs[-1], y), width=0.7)
        for x in xs:
            page.draw_line(fitz.Point(x, ys[0]), fitz.Point(x, ys[-1]), width=0.7)
        document.save(path)
        document.close()

    def test_raw_and_rebuilt_text_disagree_on_this_page(self):
        """Guard the guard: if this stops disagreeing the next test proves nothing."""
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "image-dominant-grid.pdf")
            self.build_image_dominant_grid(path)
            with fitz.open(path) as document:
                page = document[0]
                raw = page.get_text("text", sort=True) or ""
                rebuilt = extractor.table_aware_page_text(page, extractor.likely_table_candidates(page))
                self.assertGreaterEqual(extractor.page_image_coverage_ratio(page), 0.45)
                self.assertNotEqual(
                    extractor.should_ocr_page(raw, page),
                    extractor.should_ocr_page(rebuilt, page),
                    "fixture no longer exercises the threshold crossing",
                )

    def test_extract_takes_the_ocr_decision_from_raw_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "image-dominant-grid.pdf")
            self.build_image_dominant_grid(path)
            with fitz.open(path) as document:
                page = document[0]
                raw = page.get_text("text", sort=True) or ""
                expected = extractor.should_ocr_page(raw, page)

            output = os.path.join(directory, "out")
            os.makedirs(output, exist_ok=True)
            result = extractor.extract(path, output)
            first = result["pages"][0]
            attempted = bool(first["ocrUsed"]) or bool(first["needsOcr"])
            self.assertEqual(
                attempted,
                expected,
                "OCR decision must follow the raw embedded text, not the table-aware rewrite",
            )

    def test_raw_text_argument_is_honoured(self):
        with fitz.open() as document:
            page = document.new_page(width=400, height=400)
            page.insert_text(fitz.Point(40, 60), "Prose only.", fontsize=11)
            self.assertEqual(extractor.table_aware_page_text(page, [], raw_text="SUPPLIED"), "SUPPLIED")


if __name__ == "__main__":
    unittest.main()
