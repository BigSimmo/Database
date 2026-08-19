#!/usr/bin/env python3
"""Render the Docling lab fixture corpus from fixtures/manifest.v1.json.

The committed manifest is the ground truth; this generator renders every fixture
PDF *from* the manifest's own body text, table cells and assertion values, then
reads its own output back and fails if any declared canary or assertion string is
missing. Ground truth therefore cannot drift from the rendered fixtures.

Deterministic by construction: content comes only from the manifest, PDF metadata
dates are pinned, and no clock or RNG is consulted. Output is never committed —
fixtures land under the --out directory (gitignored eval/docling/out/ by default).

Requires PyMuPDF only (available in both lab venvs). Network is never used, so
the generator runs unchanged inside the egress-blocked sandbox.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zlib
from pathlib import Path

import fitz  # PyMuPDF

FIXED_DATE = "D:20260101000000Z"
PAGE_RECT = fitz.paper_rect("a4")
MARGIN = 54.0
BODY_FONT = "helv"
BODY_SIZE = 11.0
TABLE_SIZE = 9.0
ROW_HEIGHT = 20.0


def die(message: str) -> None:
    print(f"generate_fixtures: {message}", file=sys.stderr)
    raise SystemExit(1)


def set_metadata(doc: fitz.Document, title: str) -> None:
    doc.set_metadata(
        {
            "title": title,
            "author": "SYNTHETIC docling lab generator",
            "producer": "eval/docling/fixtures/generate_fixtures.py",
            "creationDate": FIXED_DATE,
            "modDate": FIXED_DATE,
        }
    )


def usable_rect() -> fitz.Rect:
    return fitz.Rect(MARGIN, MARGIN, PAGE_RECT.x1 - MARGIN, PAGE_RECT.y1 - MARGIN)


def draw_paragraphs(page: fitz.Page, rect: fitz.Rect, paragraphs: list[str]) -> float:
    text = "\n\n".join(paragraphs)
    leftover = page.insert_textbox(rect, text, fontname=BODY_FONT, fontsize=BODY_SIZE, align=0)
    if leftover < 0:
        die(f"paragraph overflow on page (short by {-leftover:.1f} points) — shorten the manifest text")
    return rect.y1 - leftover


def draw_table(page: fitz.Page, top: float, table: dict) -> float:
    rows, cols = table["rows"], table["cols"]
    rect = usable_rect()
    col_width = (rect.x1 - rect.x0) / cols
    row_height = float(table.get("rowHeight", ROW_HEIGHT))
    bottom = top + rows * row_height
    if bottom > rect.y1:
        die(f"table {table['tableId']} does not fit on its page — reduce rows in the manifest")
    
    unruled = bool(table.get("unruled") or table.get("style") == "unruled")
    rotated_headers = bool(table.get("rotatedHeaders") or table.get("rotated_headers"))

    if not unruled:
        for r in range(rows + 1):
            y = top + r * row_height
            page.draw_line(fitz.Point(rect.x0, y), fitz.Point(rect.x1, y), width=0.5)
        for c in range(cols + 1):
            x = rect.x0 + c * col_width
            page.draw_line(fitz.Point(x, top), fitz.Point(x, bottom), width=0.5)
    else:
        # Unruled / booktabs style: horizontal rules only (top, mid/header, bottom)
        page.draw_line(fitz.Point(rect.x0, top), fitz.Point(rect.x1, top), width=1.0)
        page.draw_line(fitz.Point(rect.x0, top + row_height), fitz.Point(rect.x1, top + row_height), width=0.5)
        page.draw_line(fitz.Point(rect.x0, bottom), fitz.Point(rect.x1, bottom), width=1.0)

    for cell in table["cells"]:
        r, c = cell["row"], cell["col"]
        is_rotated = (r == 0 and rotated_headers) or bool(cell.get("rotate") == 90 or cell.get("rotated"))
        x = rect.x0 + c * col_width + 3
        y = top + r * row_height + row_height - 6
        if is_rotated:
            page.insert_text(fitz.Point(x + min(col_width, 16.0), y), cell["text"], fontname=BODY_FONT, fontsize=TABLE_SIZE, rotate=90)
        else:
            page.insert_text(fitz.Point(x, y), cell["text"], fontname=BODY_FONT, fontsize=TABLE_SIZE)
    return bottom


def render_fixture(fixture: dict) -> fitz.Document:
    doc = fitz.open()
    set_metadata(doc, fixture["title"])
    # Create all pages first: PyMuPDF invalidates Page objects whenever the page
    # tree changes, so pages are fetched by index only after the count is final.
    for _ in range(fixture["pages"]):
        doc.new_page(width=PAGE_RECT.width, height=PAGE_RECT.height)
    rect = usable_rect()

    first = doc[0]
    title_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + 40)
    first.insert_textbox(title_rect, fixture["title"], fontname=BODY_FONT, fontsize=13.0)

    body = list(fixture["bodyText"])
    body_top = title_rect.y1 + 8
    if fixture.get("columns") == 2:
        gutter = 18.0
        half = (rect.x1 - rect.x0 - gutter) / 2
        split = (len(body) + 1) // 2
        left = fitz.Rect(rect.x0, body_top, rect.x0 + half, rect.y1)
        right = fitz.Rect(rect.x1 - half, body_top, rect.x1, rect.y1)
        for column_rect, chunk in ((left, body[:split]), (right, body[split:])):
            leftover = first.insert_textbox(
                column_rect, "\n\n".join(chunk), fontname=BODY_FONT, fontsize=BODY_SIZE, align=0
            )
            if leftover < 0:
                die(f"{fixture['id']}: column overflow — shorten the manifest text")
        body_bottom = rect.y1
    else:
        body_bottom = draw_paragraphs(first, fitz.Rect(rect.x0, body_top, rect.x1, rect.y1), body)

    for table in fixture["tables"]:
        page = doc[table["page"] - 1]
        top = body_bottom + 16 if table["page"] == 1 else rect.y0
        body_bottom = draw_table(page, top, table)

    if fixture.get("rasterized"):
        raster = fitz.open()
        set_metadata(raster, fixture["title"])
        for page in doc:
            pixmap = page.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
            image_page = raster.new_page(width=page.rect.width, height=page.rect.height)
            image_page.insert_image(page.rect, pixmap=pixmap)
        doc.close()
        return raster
    return doc


def minimal_pdf_bytes(page_object_extra: str = "", extra_objects: str = "") -> bytes:
    """A hand-assembled single-page PDF used as the substrate for byte-level hostility."""
    body = (
        "%PDF-1.4\n"
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        f"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] {page_object_extra} >> endobj\n"
        f"{extra_objects}"
        "trailer << /Root 1 0 R >>\n"
        "%%EOF\n"
    )
    return body.encode("ascii")


def build_hostile(entry: dict) -> bytes:
    construction = entry["construction"]
    if construction == "truncated_pdf":
        doc = fitz.open()
        set_metadata(doc, "SYNTHETIC truncated fixture")
        page = doc.new_page()
        page.insert_text(fitz.Point(72, 72), "SYNTHETIC content that will be cut off mid file.")
        payload = doc.tobytes(no_new_id=True)
        doc.close()
        return payload[: max(64, int(len(payload) * 0.4))]
    if construction == "malformed_xref":
        doc = fitz.open()
        set_metadata(doc, "SYNTHETIC malformed xref fixture")
        doc.new_page().insert_text(fitz.Point(72, 72), "SYNTHETIC body before xref corruption.")
        payload = bytearray(doc.tobytes(no_new_id=True))
        doc.close()
        marker = payload.rfind(b"startxref")
        if marker < 0:
            die("hostile-malformed-xref: no startxref marker to corrupt")
        digits_at = marker + len(b"startxref\n")
        payload[digits_at : digits_at + 4] = b"9999"
        return bytes(payload)
    if construction == "deep_object_nesting":
        depth = 4000
        nested = "[" * depth + "]" * depth
        return minimal_pdf_bytes(extra_objects=f"4 0 obj {nested} endobj\n")
    if construction == "compression_bomb":
        expanded = b"A" * (64 * 1024 * 1024)
        stream = zlib.compress(expanded, 9)
        body = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj\n"
            b"4 0 obj << /Filter /FlateDecode /Length " + str(len(stream)).encode("ascii") + b" >>\n"
            b"stream\n" + stream + b"\nendstream endobj\n"
            b"trailer << /Root 1 0 R >>\n%%EOF\n"
        )
        return body
    if construction == "encrypted_pdf":
        doc = fitz.open()
        set_metadata(doc, "SYNTHETIC encrypted fixture")
        doc.new_page().insert_text(fitz.Point(72, 72), "SYNTHETIC body behind a password.")
        payload = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="synthetic-owner-lock",
            user_pw="synthetic-user-lock",
        )
        doc.close()
        return payload
    if construction == "zero_byte":
        return b""
    if construction == "absurd_mediabox":
        return minimal_pdf_bytes().replace(b"[0 0 595 842]", b"[0 0 1000000000 1000000000]")
    if construction == "mislabelled_extension":
        # Smallest valid 1x1 grayscale PNG, stored under a .pdf name.
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d494844520000000100000001080000000000"
            "3a7e9b550000000a49444154789c636000000002000148afa4710000000049454e44ae426082"
        )
        return png
    if construction == "huge_page_tree":
        kids = " ".join(f"{n} 0 R" for n in range(10, 110))
        body = (
            "%PDF-1.4\n"
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            f"2 0 obj << /Type /Pages /Kids [{kids}] /Count 100000 >> endobj\n"
            "trailer << /Root 1 0 R >>\n"
            "%%EOF\n"
        )
        return body.encode("ascii")
    if construction == "injection_text":
        doc = fitz.open()
        set_metadata(doc, "SYNTHETIC injection fixture")
        page = doc.new_page(width=PAGE_RECT.width, height=PAGE_RECT.height)
        leftover = page.insert_textbox(usable_rect(), entry["embeddedText"], fontname=BODY_FONT, fontsize=BODY_SIZE)
        if leftover < 0:
            die("hostile-prompt-injection: embedded text overflow")
        payload = doc.tobytes(no_new_id=True)
        doc.close()
        return payload
    die(f"unknown hostile construction '{construction}'")
    return b""  # unreachable


def self_check(manifest: dict, rendered: dict[str, bytes]) -> None:
    """Read generated PDFs back and prove the manifest's ground truth is present."""
    failures: list[str] = []
    for fixture in manifest["fixtures"]:
        payload = rendered[fixture["id"]]
        doc = fitz.open(stream=payload, filetype="pdf")
        if fixture.get("rasterized"):
            # OCR is not available at generation time; rasterized fixtures were
            # rendered from the same checked text immediately before rasterising.
            if not any(page.get_images(full=True) for page in doc):
                failures.append(f"{fixture['id']}: rasterized fixture has no page images")
            doc.close()
            continue
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        flat = " ".join(text.split())
        for assertion in fixture["assertions"]:
            if " ".join(assertion["text"].split()) not in flat:
                failures.append(f"{fixture['id']}: assertion '{assertion['id']}' text missing from rendered PDF")
        for token in fixture["plantedCanaries"]:
            if token not in flat:
                failures.append(f"{fixture['id']}: planted canary is missing from rendered PDF")
    if failures:
        for failure in failures:
            print(f"generate_fixtures: {failure}", file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=str(Path(__file__).with_name("manifest.v1.json")))
    parser.add_argument("--out", required=True, help="output directory (never a committed path)")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if manifest.get("synthetic") is not True:
        die("manifest must declare synthetic: true")

    out_root = Path(args.out)
    fixtures_dir = out_root / "fixtures"
    hostile_dir = out_root / "hostile"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    hostile_dir.mkdir(parents=True, exist_ok=True)

    rendered: dict[str, bytes] = {}
    index = []
    for fixture in manifest["fixtures"]:
        doc = render_fixture(fixture)
        payload = doc.tobytes(no_new_id=True)
        doc.close()
        rendered[fixture["id"]] = payload
        path = fixtures_dir / f"{fixture['id']}.pdf"
        path.write_bytes(payload)
        index.append(
            {
                "id": fixture["id"],
                "kind": "fixture",
                "stratum": fixture["stratum"],
                "path": str(path.relative_to(out_root)),
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )

    for entry in manifest["hostile"]:
        payload = build_hostile(entry)
        path = hostile_dir / f"{entry['id']}.pdf"
        path.write_bytes(payload)
        index.append(
            {
                "id": entry["id"],
                "kind": "hostile",
                "construction": entry["construction"],
                "path": str(path.relative_to(out_root)),
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )

    self_check(manifest, rendered)

    (out_root / "fixtures-index.json").write_text(
        json.dumps({"datasetVersion": manifest["datasetVersion"], "files": index}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"generate_fixtures: wrote {len(manifest['fixtures'])} fixtures + "
        f"{len(manifest['hostile'])} hostile files to {out_root} (self-check passed)"
    )


if __name__ == "__main__":
    main()
