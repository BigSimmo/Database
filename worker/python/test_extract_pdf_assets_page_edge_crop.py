"""Red regression for #076: page-edge table crops omit on-page remnant geometry.

Failing stage: pymupdf_find_tables candidate detection (before save_page_crop).
Expected geometry: table_crop clip bottom reaches the page bottom (or reports incompleteness)
so the on-page remnant of a straddling final row is not silently dropped.

This module uses unittest.expectedFailure until a minimal geometry fix lands.
Do not "fix" by widening padding/timeouts/storage — see docs/outstanding-issues.md #076.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import extract_pdf_assets as extractor

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
FIXTURE_PDF = os.path.join(FIXTURE_DIR, "malformed-table-crop-page-edge.pdf")

# Geometry pinned by the checked-in synthetic fixture (A4).
PAGE_WIDTH = 595.28
PAGE_HEIGHT = 841.89
STRADDLING_ROW_Y0 = 824.0
EXPECTED_CLIP_BOTTOM = PAGE_HEIGHT  # include on-page remnant through the page edge
EXPECTED_SCORE_ROW = "5"


@unittest.skipUnless(os.path.isfile(FIXTURE_PDF), "page-edge crop fixture missing")
class PageEdgeTableCropGeometryTests(unittest.TestCase):
    def test_fixture_find_tables_stage_drops_straddling_row_bbox(self):
        """Diagnosis probe: names the exact failing stage without requiring a green crop yet."""
        document = extractor.fitz.open(FIXTURE_PDF)
        try:
            page = document[0]
            self.assertAlmostEqual(float(page.rect.width), PAGE_WIDTH, places=2)
            self.assertAlmostEqual(float(page.rect.height), PAGE_HEIGHT, places=2)

            tables = page.find_tables()
            self.assertGreaterEqual(len(tables.tables), 1, "fixture must expose a find_tables candidate")
            candidate = extractor.fitz.Rect(tables.tables[0].bbox)
            # Current-main defect: candidate stops at the last fully detected row.
            self.assertLess(
                candidate.y1,
                EXPECTED_CLIP_BOTTOM - 1,
                "diagnosis changed: find_tables now includes the page-edge remnant",
            )
            self.assertAlmostEqual(candidate.y1, STRADDLING_ROW_Y0, places=1)
        finally:
            document.close()

    @unittest.expectedFailure
    def test_table_crop_includes_on_page_remnant_of_straddling_row(self):
        """
        Red contract (#076).

        Stage: pymupdf_find_tables → expanded_rect → save_page_crop (sourceKind=table_crop)
        Expected geometry: clip_bbox[3] >= page_height - 1 (on-page remnant retained)
        Expected structure: table_rows includes the score-5 clinical row (or incompleteness is marked)
        """
        with tempfile.TemporaryDirectory(prefix="page-edge-crop-") as output_dir:
            result = extractor.extract(FIXTURE_PDF, output_dir)
            crops = [image for image in result["images"] if image.get("sourceKind") == "table_crop"]
            self.assertEqual(len(crops), 1, result)
            crop = crops[0]
            metadata = crop.get("metadata") or {}
            clip = crop.get("bbox") or metadata.get("clip_bbox")
            self.assertIsInstance(clip, list)
            self.assertGreaterEqual(len(clip), 4)

            clip_bottom = float(clip[3])
            page_height = float(metadata.get("page_height") or PAGE_HEIGHT)
            self.assertGreaterEqual(
                clip_bottom,
                page_height - 1.0,
                (
                    "stage=pymupdf_find_tables→save_page_crop; "
                    f"expected clip bottom ≥ {page_height - 1.0}, got {clip_bottom}; "
                    f"candidate method={metadata.get('extraction_method')}"
                ),
            )

            rows = metadata.get("table_rows") or []
            has_score_row = any(str(row[0]).strip() == EXPECTED_SCORE_ROW for row in rows if row)
            crop_completeness = metadata.get("crop_completeness")
            incomplete = (
                isinstance(crop_completeness, (int, float)) and float(crop_completeness) < 0.99
            ) or any("crop" in str(warning).lower() and "incomplete" in str(warning).lower() for warning in result.get("warnings") or [])
            self.assertTrue(
                has_score_row or incomplete,
                (
                    "expected score-5 row in table_rows or an explicit incompleteness signal; "
                    f"rows={rows!r} crop_completeness={crop_completeness!r} warnings={result.get('warnings')!r}"
                ),
            )


if __name__ == "__main__":
    unittest.main()
