"""Shadow-extraction runner contract (packet B4).

Runs at worker image build inside the OCR venv, which deliberately has NO docling — so these
tests never import docling. They pin the aggregate-only projection, the numeric-token pattern
shared with worker/shadow-extraction.ts, and the exit-code contract the TypeScript side maps to
`runtime_unavailable` / `extraction_failed` / `ok`.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
import shadow_docling_extract as shadow


class _Cell:
    def __init__(self, text):
        self.text = text


class _TableData:
    def __init__(self, grid):
        self.grid = grid


class _Table:
    def __init__(self, grid):
        self.data = _TableData(grid)


class _FakeDocument:
    """Duck-typed stand-in for docling's DoclingDocument."""

    def __init__(self, markdown, pages, tables):
        self._markdown = markdown
        self.pages = {index: object() for index in range(1, pages + 1)}
        self.tables = tables

    def export_to_markdown(self):
        return self._markdown


class _FakeConversionResult:
    def __init__(self, document):
        self.document = document


class _FakeConverter:
    def __init__(self, document=None, error=None):
        self._document = document
        self._error = error

    def convert(self, path, raises_on_error=True):
        if self._error is not None:
            raise self._error
        return _FakeConversionResult(self._document)


CANARY = "CANARY-SHADOW-LEAK-TOKEN"


TS_MODULE = Path(__file__).resolve().parents[1] / "shadow-extraction.ts"


class NumericTokenPatternTests(unittest.TestCase):
    # The TypeScript source is not shipped in the worker image (only worker/python is copied),
    # so the cross-language pin runs where both files exist: the repository checkout. The
    # vitest side (tests/worker-shadow-extraction.test.ts) pins the same equality unconditionally.
    @unittest.skipUnless(TS_MODULE.is_file(), "TypeScript source not present (image build)")
    def test_pattern_text_matches_typescript_constant(self):
        ts_source = TS_MODULE.read_text(encoding="utf-8")
        self.assertIn(
            'SHADOW_NUMERIC_TOKEN_PATTERN = "' + shadow.NUMERIC_TOKEN_PATTERN.pattern + '"',
            ts_source,
            "numeric-token pattern must be identical on both sides of the shadow record",
        )

    def test_counts_ascii_numbers_only(self):
        # 0.6, 1.0, 250 — the Arabic-Indic digit is deliberately not counted (ASCII-only pattern).
        self.assertEqual(shadow.count_numeric_tokens("lithium 0.6-1.0 mmol/L, 250 mg bd, ٣ tablets"), 3)
        self.assertEqual(shadow.count_numeric_tokens(""), 0)


class ProjectionTests(unittest.TestCase):
    def test_summary_is_numbers_only(self):
        document = _FakeDocument(
            markdown=f"# Dose table\n\n| drug | dose |\n| A | 20 mg |\n\n{CANARY} 1,000 mg 2.5",
            pages=3,
            tables=[_Table([[_Cell("drug"), _Cell("dose")], [_Cell("A"), _Cell(" ")], [_Cell(""), _Cell("20 mg")]])],
        )
        summary = shadow.summarize_document(document)
        self.assertEqual(
            summary,
            {
                "page_count": 3,
                "text_character_count": len(document.export_to_markdown()),
                "table_count": 1,
                "table_cell_count": 4,
                "numeric_token_count": 3,
            },
        )
        self.assertNotIn(CANARY, json.dumps(summary))
        for value in summary.values():
            self.assertIsInstance(value, int)


class ExitContractTests(unittest.TestCase):
    def _run(self, factory):
        with tempfile.TemporaryDirectory() as work_dir:
            result_path = Path(work_dir) / "result.json"
            code = shadow.run(Path(work_dir) / "missing.pdf", result_path, converter_factory=factory)
            payload = json.loads(result_path.read_text(encoding="utf-8"))
        return code, payload

    def test_missing_docling_exits_20_with_runtime_unavailable(self):
        def factory():
            raise shadow.DoclingUnavailableError("No module named 'docling'")

        code, payload = self._run(factory)
        self.assertEqual(code, shadow.EXIT_RUNTIME_UNAVAILABLE)
        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["error_kind"], "runtime_unavailable")

    def test_real_build_converter_in_this_venv_is_unavailable_or_importable(self):
        # In the OCR venv docling is absent by design; in the docling venv it must import.
        try:
            shadow.build_converter()
        except shadow.DoclingUnavailableError:
            return
        except Exception as exc:  # noqa: BLE001 - a docling venv without models etc. is a build failure
            self.fail(f"docling import path failed unexpectedly: {type(exc).__name__}")

    def test_converter_failure_exits_10_with_class_name_only(self):
        error = ValueError(f"secret path /tmp/{CANARY}.pdf")
        code, payload = self._run(lambda: _FakeConverter(error=error))
        self.assertEqual(code, shadow.EXIT_EXTRACTION_FAILED)
        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["error_kind"], "ValueError")
        self.assertNotIn(CANARY, json.dumps(payload))

    def test_success_exits_0_with_aggregates(self):
        document = _FakeDocument(markdown=f"{CANARY} 5 mg", pages=2, tables=[])
        code, payload = self._run(lambda: _FakeConverter(document=document))
        self.assertEqual(code, shadow.EXIT_OK)
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["page_count"], 2)
        self.assertEqual(payload["numeric_token_count"], 1)
        self.assertNotIn(CANARY, json.dumps(payload))
        self.assertTrue(payload["peak_rss_bytes"] is None or isinstance(payload["peak_rss_bytes"], int))


if __name__ == "__main__":
    unittest.main()
