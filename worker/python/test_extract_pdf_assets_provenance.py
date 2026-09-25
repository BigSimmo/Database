"""Every extraction records which reader produced it (audit F04).

When a parser defect is found (the clozapine column interleaving, #GJHKYC), the
documents it affected must be listable. Each result carries the extractor name,
its behaviour version, the PyMuPDF build and the table strategy; the worker
stores that on documents.metadata.extraction_provenance.
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


class ProvenanceTests(unittest.TestCase):
    def test_result_names_the_extractor_version_and_table_strategy(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "plain.pdf")
            document = fitz.open()
            document.new_page(width=300, height=300).insert_text(fitz.Point(30, 40), "Plain text.", fontsize=11)
            document.save(path)
            document.close()
            result = extractor.extract(path, os.path.join(directory, "out"))
        provenance = result["extractor"]
        self.assertEqual(provenance["name"], "extract_pdf_assets")
        self.assertEqual(provenance["version"], extractor.EXTRACTOR_VERSION)
        self.assertRegex(provenance["version"], r"^\d{4}-\d{2}-\d{2}\.[a-z0-9-]+$")
        self.assertEqual(provenance["tableStrategy"], "table_aware_page_text")
        self.assertTrue(provenance["pymupdf"])


if __name__ == "__main__":
    unittest.main()
