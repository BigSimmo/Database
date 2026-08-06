"""Cover-page thumbnail extraction for document search cards."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import extract_pdf_assets as extractor

FIXTURE_PDF = Path(__file__).resolve().parents[2] / "public" / "demo-documents" / "synthetic-lithium-monitoring.pdf"


class CoverPageExtractionTests(unittest.TestCase):
    def test_extract_emits_non_searchable_cover_page(self):
        self.assertTrue(FIXTURE_PDF.is_file(), f"missing fixture {FIXTURE_PDF}")
        with tempfile.TemporaryDirectory() as output_dir:
            result = extractor.extract(str(FIXTURE_PDF), output_dir)
            covers = [image for image in result["images"] if image.get("sourceKind") == "cover_page"]
            self.assertEqual(len(covers), 1, "expected exactly one cover_page image")
            cover = covers[0]
            self.assertEqual(cover["pageNumber"], 1)
            self.assertEqual(cover["mimeType"], "image/png")
            self.assertTrue(os.path.isfile(cover["path"]))
            self.assertGreaterEqual(cover["width"], 64)
            self.assertGreaterEqual(cover["height"], 64)
            self.assertEqual(cover["metadata"]["source_kind"], "cover_page")
            self.assertEqual(cover["metadata"]["clinical_use_class"], "decorative_or_empty")
            # Cover must remain non-searchable and must not be the only way to
            # identify the image list shape used by the indexer.
            self.assertNotEqual(cover.get("searchable"), True)


if __name__ == "__main__":
    unittest.main()
