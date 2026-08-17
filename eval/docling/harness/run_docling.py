#!/usr/bin/env python3
"""run_docling — single-document Docling runner for the isolated lab.

Invoked per fixture by harness/run_corpus.py from the docling venv:

    /opt/docling-venv/bin/python eval/docling/harness/run_docling.py \
        --file <pdf> --result <json>

Converter configuration is pinned for comparability with the legacy extractor:
CPU only, tesseract-CLI OCR (the same OCR engine the worker uses), table structure
on, and models loaded from DOCLING_ARTIFACTS_PATH — baked into the lab image at
build time, because the sandboxed run has no network to download them.

The result file is raw material for harness/score.py only; it may carry extracted
text and never leaves out/raw/. Exit codes: 0 success, 10 clean extraction failure
(a legitimate benchmark outcome for the hostile corpus), anything else is a crash.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

TEXT_CAP_BYTES = int(os.environ.get("LAB_PER_DOC_TEXT_BYTES", str(64 * 1024 * 1024)))


def build_converter():
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    options = PdfPipelineOptions(artifacts_path=artifacts_path) if artifacts_path else PdfPipelineOptions()
    options.do_ocr = True
    options.ocr_options = TesseractCliOcrOptions()
    options.do_table_structure = True
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})


def table_payloads(document) -> list[dict]:
    tables = []
    for table in getattr(document, "tables", []):
        cells: list[dict] = []
        rows = cols = None
        data = getattr(table, "data", None)
        grid = getattr(data, "grid", None)
        if grid:
            rows = len(grid)
            cols = max((len(row) for row in grid), default=0)
            for row_index, row in enumerate(grid):
                for col_index, cell in enumerate(row):
                    text = getattr(cell, "text", "")
                    if isinstance(text, str) and text.strip():
                        cells.append({"row": row_index, "col": col_index, "text": text})
        tables.append({"rows": rows, "cols": cols, "cells": cells})
    return tables


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--result", required=True)
    args = parser.parse_args()
    file_path = Path(args.file)
    result_path = Path(args.result)

    try:
        converter = build_converter()
        result = converter.convert(str(file_path), raises_on_error=True)
        document = result.document
        text = document.export_to_markdown()
        payload = {
            "engine": "docling",
            "ok": True,
            "fileName": file_path.name,
            "pages": len(getattr(document, "pages", {}) or {}),
            "textChars": len(text),
            "text": text.encode("utf-8")[:TEXT_CAP_BYTES].decode("utf-8", errors="ignore"),
            "tables": table_payloads(document),
            "warnings": [],
        }
        result_path.write_text(json.dumps(payload), encoding="utf-8")
        return 0
    except Exception as error:  # noqa: BLE001 — any converter failure is a recorded outcome
        payload = {
            "engine": "docling",
            "ok": False,
            "fileName": file_path.name,
            "error": {"name": type(error).__name__, "message": str(error)[:500]},
        }
        result_path.write_text(json.dumps(payload), encoding="utf-8")
        return 10


if __name__ == "__main__":
    sys.exit(main())
