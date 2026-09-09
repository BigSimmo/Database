"""Embedded-image normalisation (audit L12).

One vision-rejected embedded image must not be able to fail a whole document.
The extractor's half of that: never hand the worker a MIME type the vision
provider rejects (image/jpx, image/jb2, image/tiff, ... derived straight from
PyMuPDF's filter extension), and never emit a single raw stream larger than the
per-image cap.
"""

from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import extract_pdf_assets as extractor


class FakePixmap:
    def __init__(self, png_bytes=b"PNGDATA", width=10, height=10, n=3, alpha=0):
        self._png = png_bytes
        self.width = width
        self.height = height
        self.n = n
        self.alpha = alpha

    def tobytes(self, fmt):
        assert fmt == "png"
        return self._png


class EmbeddedImageNormalisationTests(unittest.TestCase):
    def test_web_safe_formats_keep_their_bytes_and_get_a_web_mime_type(self):
        budget = extractor.ExtractionBudget()
        for ext, mime in (("jpg", "image/jpeg"), ("jpeg", "image/jpeg"), ("png", "image/png")):
            payload, warning = extractor.normalize_embedded_image(
                object(), 7, {"ext": ext, "image": b"RAW", "width": 10, "height": 10}, budget
            )
            self.assertIsNone(warning)
            self.assertIsNotNone(payload)
            self.assertEqual(payload["bytes"], b"RAW")
            self.assertEqual(payload["mime"], mime)

    def test_non_web_formats_are_re_encoded_to_png_instead_of_image_jpx(self):
        budget = extractor.ExtractionBudget()
        for ext in ("jpx", "jb2", "tiff", "bmp", "pnm"):
            with patch.object(extractor.fitz, "Pixmap", return_value=FakePixmap()):
                payload, warning = extractor.normalize_embedded_image(
                    object(), 7, {"ext": ext, "image": b"RAWSTREAM", "width": 10, "height": 10}, budget
                )
            self.assertIsNone(warning, ext)
            self.assertIsNotNone(payload, ext)
            self.assertEqual(payload["ext"], "png", ext)
            self.assertEqual(payload["mime"], "image/png", ext)
            self.assertEqual(payload["bytes"], b"PNGDATA", ext)
            # The rejected MIME types must not survive anywhere in the payload.
            self.assertNotIn(f"image/{ext}", payload.values())

    def test_a_re_encode_failure_skips_that_image_with_a_warning_not_an_exception(self):
        budget = extractor.ExtractionBudget()
        with patch.object(extractor.fitz, "Pixmap", side_effect=RuntimeError("unsupported colorspace")):
            payload, warning = extractor.normalize_embedded_image(
                object(), 42, {"ext": "jpx", "image": b"RAWSTREAM", "width": 10, "height": 10}, budget
            )
        self.assertIsNone(payload)
        self.assertIsNotNone(warning)
        self.assertIn("42", warning)
        self.assertNotIn("RAWSTREAM", warning)

    def test_an_oversized_single_image_is_capped_rather_than_emitted(self):
        budget = extractor.ExtractionBudget()
        payload, warning = extractor.normalize_embedded_image(
            object(),
            9,
            {"ext": "png", "image": b"x" * (extractor.MAX_EMBEDDED_IMAGE_BYTES + 1), "width": 10, "height": 10},
            budget,
        )
        self.assertIsNone(payload)
        self.assertIsNotNone(warning)
        self.assertIn(str(extractor.MAX_EMBEDDED_IMAGE_BYTES), warning)

    def test_a_non_web_image_beyond_the_pixel_budget_is_skipped_before_re_encoding(self):
        budget = extractor.ExtractionBudget()
        max_pixels = budget.limits["maxRenderPixels"]

        def explode(*_args, **_kwargs):
            raise AssertionError("must not render an image beyond the pixel budget")

        with patch.object(extractor.fitz, "Pixmap", side_effect=explode):
            payload, warning = extractor.normalize_embedded_image(
                object(),
                11,
                {"ext": "jpx", "image": b"RAW", "width": max_pixels, "height": 2},
                budget,
            )
        self.assertIsNone(payload)
        self.assertIsNotNone(warning)
        self.assertIn("pixel", warning)

    def test_the_mime_helper_never_returns_a_pdf_filter_extension(self):
        self.assertEqual(extractor.embedded_image_mime_type("JPG"), "image/jpeg")
        self.assertEqual(extractor.embedded_image_mime_type("jpeg"), "image/jpeg")
        self.assertEqual(extractor.embedded_image_mime_type("png"), "image/png")
        self.assertEqual(extractor.embedded_image_mime_type("webp"), "image/webp")
        self.assertEqual(extractor.embedded_image_mime_type("gif"), "image/gif")
        # Anything the vision provider will not accept collapses to png, which is
        # what the re-encode above actually produced.
        self.assertEqual(extractor.embedded_image_mime_type("jpx"), "image/png")
        self.assertEqual(extractor.embedded_image_mime_type(""), "image/png")


if __name__ == "__main__":
    unittest.main()
