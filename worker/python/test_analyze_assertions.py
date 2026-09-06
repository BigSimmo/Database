"""Assertion-tagging safe-logging guard: malformed-chunk warnings must never
carry chunk text (clinical guideline content), only a positional index."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import analyze_assertions  # noqa: E402


class MalformedChunkWarningTests(unittest.TestCase):
    def test_warning_omits_chunk_text_and_names_the_index(self):
        secret_text = "Lithium levels above 1.5 mmol/L require urgent review of the dosing regimen."
        payload = {
            "chunks": [
                {"id": "chunk-1", "text": "fine"},
                {"text": secret_text},  # malformed: missing "id"
            ],
            # No targets: analyze_assertions.run() skips loading medspaCy models
            # entirely and takes the "nlp is None" branch for well-formed chunks.
            "targets": [],
        }
        with tempfile.TemporaryDirectory() as tmp:
            input_path = os.path.join(tmp, "input.json")
            output_path = os.path.join(tmp, "output.json")
            with open(input_path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)

            analyze_assertions.run(input_path, output_path)

            with open(output_path, "r", encoding="utf-8") as handle:
                result = json.load(handle)

        malformed_warnings = [w for w in result["warnings"] if "malformed" in w]
        self.assertEqual(len(malformed_warnings), 1)
        warning = malformed_warnings[0]
        self.assertNotIn(secret_text, warning)
        self.assertNotIn("Lithium", warning)
        self.assertIn("index 1", warning)


if __name__ == "__main__":
    unittest.main()
