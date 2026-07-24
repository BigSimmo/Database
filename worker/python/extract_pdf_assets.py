import io
import json
import math
import os
import re
import sys
from statistics import median

try:
    import fitz  # PyMuPDF
except Exception as exc:
    print(f"PyMuPDF is required for robust PDF extraction: {exc}", file=sys.stderr)
    sys.exit(2)


# IDX-H6: caps on serialized table size. Raised from the previous 80/120-row and 8000-char
# limits so realistic long clinical tables (dose/threshold grids) are not silently truncated
# mid-table. When a cap is still hit we record rows_truncated/row_count so the truncation is
# observable in index_quality rather than dropping tail rows invisibly.
MAX_TABLE_ROWS = 400
MAX_TABLE_TEXT_CHARS = 24000
TARGET_CROP_DPI = 220
MAX_RENDER_SCALE = 4.0
MIN_USEFUL_RENDER_SCALE = 0.25

DEFAULT_BUDGET = {
    "version": 1,
    "maxRenderPixels": 4_000_000,
    "maxPages": 5_000,
    "maxArtifacts": 10_000,
    "maxArtifactBytes": 512 * 1024 * 1024,
    "maxTextBytes": 64 * 1024 * 1024,
    "maxResultBytes": 64 * 1024 * 1024,
    "ocrPageTimeoutSeconds": 60,
    "totalTimeoutMs": 15 * 60 * 1000,
}


class ExtractionBudgetExceeded(RuntimeError):
    pass


class ExtractionBudget:
    def __init__(self, limits=None):
        self.limits = {**DEFAULT_BUDGET, **(limits or {})}
        for key, value in self.limits.items():
            if not isinstance(value, int) or value <= 0:
                raise ValueError(f"Invalid PDF extraction budget value for {key}")
        self.page_count = 0
        self.artifact_count = 0
        self.artifact_bytes = 0
        self.text_bytes = 0

    def set_page_count(self, count):
        if count > self.limits["maxPages"]:
            raise ExtractionBudgetExceeded(
                f"page count {count} exceeds {self.limits['maxPages']}"
            )
        self.page_count = count

    def add_text(self, text):
        self.text_bytes += len((text or "").encode("utf-8"))
        if self.text_bytes > self.limits["maxTextBytes"]:
            raise ExtractionBudgetExceeded(
                f"extracted UTF-8 text exceeds {self.limits['maxTextBytes']} bytes"
            )

    def add_artifact(self, byte_length):
        next_count = self.artifact_count + 1
        next_bytes = self.artifact_bytes + max(0, int(byte_length))
        if next_count > self.limits["maxArtifacts"]:
            raise ExtractionBudgetExceeded(
                f"artifact count {next_count} exceeds {self.limits['maxArtifacts']}"
            )
        if next_bytes > self.limits["maxArtifactBytes"]:
            raise ExtractionBudgetExceeded(
                f"temporary artifact bytes exceed {self.limits['maxArtifactBytes']}"
            )
        self.artifact_count = next_count
        self.artifact_bytes = next_bytes

    def ensure_artifact_slot(self):
        if self.artifact_count + 1 > self.limits["maxArtifacts"]:
            raise ExtractionBudgetExceeded(
                f"artifact count {self.artifact_count + 1} exceeds {self.limits['maxArtifacts']}"
            )

    def ensure_result(self, serialized):
        byte_length = len(serialized.encode("utf-8"))
        if byte_length > self.limits["maxResultBytes"]:
            raise ExtractionBudgetExceeded(
                f"result JSON exceeds {self.limits['maxResultBytes']} bytes"
            )

    def usage(self):
        return {
            "pages": self.page_count,
            "artifacts": self.artifact_count,
            "artifactBytes": self.artifact_bytes,
            "textBytes": self.text_bytes,
        }


def bounded_render_scale(rect, desired_scale, max_pixels):
    width = float(rect.width)
    height = float(rect.height)
    if not all(math.isfinite(value) and value > 0 for value in (width, height, desired_scale)):
        return None
    scale = min(float(desired_scale), MAX_RENDER_SCALE)
    scale = min(scale, math.sqrt(max_pixels / (width * height)))
    if not math.isfinite(scale) or scale < MIN_USEFUL_RENDER_SCALE:
        return None

    # PyMuPDF rounds transformed dimensions. Use conservative ceiling dimensions
    # and a small multiplicative correction rather than relying on float equality.
    for _ in range(4):
        rounded_pixels = math.ceil(width * scale) * math.ceil(height * scale)
        if rounded_pixels <= max_pixels:
            break
        scale *= math.sqrt(max_pixels / rounded_pixels) * (1.0 - 1e-9)
    if math.ceil(width * scale) * math.ceil(height * scale) > max_pixels:
        return None
    if scale < MIN_USEFUL_RENDER_SCALE:
        return None
    return scale


def maybe_ocr_page(page, budget):
    render_scale = bounded_render_scale(
        page.rect, 2.0, budget.limits["maxRenderPixels"]
    )
    if render_scale is None:
        return "", f"render_skipped: OCR page {page.number + 1} has unsafe geometry"
    try:
        import pytesseract
        from PIL import Image

        tesseract_cmd = os.environ.get("TESSERACT_CMD")
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        elif os.name == "nt":
            for candidate in (
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ):
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        pix = page.get_pixmap(
            matrix=fitz.Matrix(render_scale, render_scale), alpha=False
        )
        if pix.width * pix.height > budget.limits["maxRenderPixels"]:
            return "", f"render_skipped: OCR page {page.number + 1} exceeded the rounded pixel limit"
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(
            image, timeout=budget.limits["ocrPageTimeoutSeconds"]
        ), None
    except Exception as exc:
        return "", f"OCR failed on page {page.number + 1}: {type(exc).__name__}: {exc}"


def page_image_coverage_ratio(page):
    """Fraction of the page area covered by raster images (clamped to 1.0).

    IDX-H4: dose/threshold tables are frequently rendered as a large image with only a
    short heading/caption of real text. A flat character floor misses those pages, so we
    also use image coverage to decide whether a page is image-dominant.
    """
    page_area = float(page.rect.width) * float(page.rect.height)
    if page_area <= 0:
        return 0.0
    covered = 0.0
    seen = set()
    for image_info in page.get_images(full=True):
        xref = image_info[0]
        if xref in seen:
            continue
        seen.add(xref)
        for rect in page.get_image_rects(xref) or []:
            covered += abs(float(rect.width) * float(rect.height))
    return min(1.0, covered / page_area)


def should_ocr_page(text, page):
    """Decide whether to OCR a page based on text density vs. image coverage.

    IDX-H4: OCR when the embedded text layer is near-empty (old behaviour) OR when the page
    is image-dominant with low text density even though it clears the old 40-char floor —
    e.g. an image-rendered dose table with a >40-char caption.
    """
    stripped = text.strip()
    if len(stripped) < 40:
        return True
    coverage = page_image_coverage_ratio(page)
    # Low text density for a page that is mostly image -> the real content is in the image.
    if coverage >= 0.45 and len(stripped) < 220:
        return True
    return False


def merge_ocr_text(existing_text, ocr_text):
    """Combine the embedded text layer with OCR output without dropping either (IDX-H4)."""
    existing = (existing_text or "").strip()
    ocr = (ocr_text or "").strip()
    if not ocr:
        return existing_text
    if not existing:
        return ocr_text
    if ocr in existing:
        return existing_text
    return f"{existing_text.rstrip()}\n{ocr}"


def rect_payload(rect):
    return [round(rect.x0, 2), round(rect.y0, 2), round(rect.x1, 2), round(rect.y1, 2)]


def write_pixmap(pix, path, budget):
    image_bytes = pix.tobytes("png")
    budget.add_artifact(len(image_bytes))
    with open(path, "wb") as handle:
        handle.write(image_bytes)
    return {"width": pix.width, "height": pix.height}


def save_page_crop(page, rect, output_dir, file_name, source_kind, metadata, budget, warnings):
    page_rect = page.rect
    clipped = rect & page_rect
    if clipped.is_empty:
        return None

    if clipped.width < 80 or clipped.height < 60:
        return None

    render_scale = bounded_render_scale(
        clipped,
        TARGET_CROP_DPI / 72.0,
        budget.limits["maxRenderPixels"],
    )
    if render_scale is None:
        warnings.append(
            f"render_skipped: {source_kind} page {metadata['pageNumber']} has unsafe geometry"
        )
        return None
    budget.ensure_artifact_slot()
    pix = page.get_pixmap(matrix=fitz.Matrix(render_scale, render_scale), clip=clipped, alpha=False)
    if pix.width * pix.height > budget.limits["maxRenderPixels"]:
        warnings.append(
            f"render_skipped: {source_kind} page {metadata['pageNumber']} exceeded the rounded pixel limit"
        )
        return None
    if pix.width < 180 or pix.height < 120:
        return None

    image_path = os.path.join(output_dir, file_name)
    dimensions = write_pixmap(pix, image_path, budget)
    crop_completeness = crop_completeness_score(rect, clipped, page.rect)
    crop_metadata = {
        **metadata,
        "bbox": rect_payload(rect),
        "clip_bbox": rect_payload(clipped),
        "page_width": round(float(page.rect.width), 2),
        "page_height": round(float(page.rect.height), 2),
        "page_rotation": int(page.rotation or 0),
        "render_scale": round(render_scale, 3),
        "render_dpi": round(render_scale * 72),
        "crop_completeness": crop_completeness,
        "crop_touches_page_edge": crop_completeness < 0.99,
        "source_regions": [
            {
                "source_kind": source_kind,
                "bbox": rect_payload(clipped),
                "page_number": metadata["pageNumber"],
            }
        ],
    }
    return {
        "pageNumber": metadata["pageNumber"],
        "path": image_path,
        "mimeType": "image/png",
        "bbox": rect_payload(clipped),
        "width": dimensions["width"],
        "height": dimensions["height"],
        "sourceKind": source_kind,
        "metadata": crop_metadata,
    }


def expanded_rect(rect, page_rect, x_padding=4, y_padding=4):
    return fitz.Rect(
        rect.x0 - x_padding,
        rect.y0 - y_padding,
        rect.x1 + x_padding,
        rect.y1 + y_padding,
    )


def table_expanded_rect(rect, page_rect):
    return expanded_rect(rect, page_rect, x_padding=10, y_padding=18)


def crop_completeness_score(requested_rect, clipped_rect, page_rect):
    requested_area = max(float(requested_rect.width) * float(requested_rect.height), 1.0)
    clipped_area = max(float(clipped_rect.width) * float(clipped_rect.height), 0.0)
    score = min(1.0, clipped_area / requested_area)
    edge_penalty = 0.0
    tolerance = 1.0
    if abs(clipped_rect.x0 - page_rect.x0) <= tolerance or abs(clipped_rect.x1 - page_rect.x1) <= tolerance:
        edge_penalty += 0.04
    if abs(clipped_rect.y0 - page_rect.y0) <= tolerance or abs(clipped_rect.y1 - page_rect.y1) <= tolerance:
        edge_penalty += 0.04
    return round(max(0.0, score - edge_penalty), 3)


def rect_intersection_ratio(a, b):
    intersection = a & b
    if intersection.is_empty:
        return 0
    intersection_area = intersection.width * intersection.height
    smaller_area = max(min(a.width * a.height, b.width * b.height), 1)
    return intersection_area / smaller_area


def merge_rects(rects, page_rect):
    if not rects:
        return None
    x0 = max(min(rect.x0 for rect in rects) - 12, page_rect.x0)
    y0 = max(min(rect.y0 for rect in rects) - 12, page_rect.y0)
    x1 = min(max(rect.x1 for rect in rects) + 12, page_rect.x1)
    y1 = min(max(rect.y1 for rect in rects) + 12, page_rect.y1)
    return fitz.Rect(x0, y0, x1, y1)


def clean_cell(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def table_rows_to_markdown(rows):
    cleaned = [[clean_cell(cell) for cell in row] for row in rows if any(clean_cell(cell) for cell in row)]
    if not cleaned:
        return ""

    column_count = max(len(row) for row in cleaned)
    padded = [row + [""] * (column_count - len(row)) for row in cleaned]
    header = padded[0]
    separator = ["---"] * column_count
    body = padded[1:]

    def markdown_row(row):
        escaped = [cell.replace("|", "\\|") for cell in row]
        return "| " + " | ".join(escaped) + " |"

    return "\n".join([markdown_row(header), markdown_row(separator), *[markdown_row(row) for row in body]])


def table_columns_from_rows(rows):
    cleaned = [[clean_cell(cell) for cell in row] for row in rows if any(clean_cell(cell) for cell in row)]
    if not cleaned:
        return []
    return cleaned[0]


def text_grid_rows(text):
    rows = []
    for line in (text or "").splitlines():
        cleaned = re.sub(r"\s+", " ", line).strip()
        if not cleaned:
            continue
        cells = [clean_cell(cell) for cell in re.split(r"\s{2,}|\t|\|", line) if clean_cell(cell)]
        rows.append(cells if len(cells) > 1 else [cleaned])
    return rows


def extract_table_payload(table):
    try:
        rows = table.extract()
        cleaned = [[clean_cell(cell) for cell in row] for row in rows if any(clean_cell(cell) for cell in row)]
        column_count = max((len(row) for row in cleaned), default=0)
        return {
            "text": table_rows_to_markdown(rows),
            "rows": cleaned[:MAX_TABLE_ROWS],
            "columns": table_columns_from_rows(rows)[:24],
            "accessible_markdown": table_rows_to_markdown(rows),
            "row_count": len(cleaned),
            "rows_truncated": len(cleaned) > MAX_TABLE_ROWS,
            "column_count": column_count,
        }
    except Exception:
        return {
            "text": "",
            "rows": [],
            "columns": [],
            "accessible_markdown": "",
            "row_count": 0,
            "rows_truncated": False,
            "column_count": 0,
        }


def extract_table_text(table):
    return extract_table_payload(table)["text"]


def split_table_heading(text):
    cleaned = re.sub(r"\s+", " ", text or "").strip(" :-\u2013\u2014")
    if not cleaned:
        return None, None

    patterns = (
        r"(?i)\b(table\s+\d+[a-z]?)\s*[:.\-\u2013\u2014]?\s*(.+)",
        r"(?i)\b(appendix\s+\d+[a-z]?)\s*[:.\-\u2013\u2014]?\s*(.+)",
    )
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            label = re.sub(r"\s+", " ", match.group(1)).title()
            title = re.sub(r"\s+", " ", match.group(2)).strip(" :-\u2013\u2014")
            return label, title[:240] if title else None

    section_match = re.search(r"(?i)(?:^|\s)\d+\.?\s+(roles and responsibilities)\b", cleaned)
    if section_match:
        return None, section_match.group(1).title()

    if re.fullmatch(r"(?i)roles and responsibilities", cleaned):
        return None, "Roles and responsibilities"

    known_section_headings = (
        "recommended pharmacological treatment options",
        "*maximum dose refers to total maximum oral and im dose (including regular)",
    )
    if cleaned.lower() in known_section_headings:
        return None, cleaned[:180]

    return None, None


def nearby_table_heading(page, rect, table_text):
    blocks = sorted(page.get_text("blocks") or [], key=lambda block: (block[1], block[0]))
    candidates = []
    for block in blocks:
        if len(block) < 5:
            continue
        x0, y0, x1, y1, text = block[:5]
        if y1 > rect.y0 + 16 or y1 < rect.y0 - 140:
            continue
        if x1 < rect.x0 - 40 or x0 > rect.x1 + 40:
            continue
        cleaned = re.sub(r"\s+", " ", str(text)).strip()
        if cleaned:
            candidates.append(cleaned)

    for candidate in reversed(candidates):
        label, title = split_table_heading(candidate)
        if label or title:
            return label, title, candidate

    lowered_table = table_text.lower()
    if "role" in lowered_table and "responsibility" in lowered_table:
        return None, "Roles and responsibilities", "Roles and responsibilities"
    return None, None, ""


def clinical_table_score(text):
    lowered = text.lower()
    score = 0
    keywords = (
        "management",
        "monitor",
        "observation",
        "medication",
        "dose",
        "benzodiazepine",
        "antipsychotic",
        "intramuscular",
        "oral",
        "risk",
        "escalat",
        "responsibil",
        "patient",
        "score",
        "frequency",
        "post im",
        "post po",
        "appendix",
        "table",
    )
    for keyword in keywords:
        if keyword in lowered:
            score += 1
    return score


def table_text_metrics(table_text):
    text = table_text or ""
    lines = [line for line in text.splitlines() if line.strip()]
    return {
        "bars": text.count("|"),
        "line_count": len(lines),
        "clinical_score": clinical_table_score(text),
    }


def table_role_for_candidate(label, title, table_text):
    combined = " ".join([label or "", title or "", table_text or ""]).lower()
    clinical_markers = (
        "management",
        "monitor",
        "observation",
        "medication",
        "dose",
        "benzodiazepine",
        "antipsychotic",
        "intramuscular",
        "oral",
        "risk",
        "escalat",
        "patient",
        "score",
        "frequency",
        "post im",
        "post po",
        "treatment",
        "assessment",
        "side effect",
        "contraindicat",
        "responsibil",
    )
    admin_markers = (
        "authorisation date",
        "published date",
        "version control",
        "document owner",
        "approval",
        "endorsed",
        "review date",
        "contact person",
        "policy sponsor",
        "compliance monitoring",
        "amendment",
        "amended",
        "revision",
        "reviewed",
        "superseded",
        "section 4.0",
        "section 13",
    )
    reference_markers = (
        "references",
        "relevant standards",
        "documents support",
        "bibliography",
        "legislation",
        "associated documents",
    )

    if title and title.lower() == "roles and responsibilities":
        return "clinical"
    if any(marker in combined for marker in reference_markers):
        return "reference"
    if any(marker in combined for marker in admin_markers):
        return "admin"
    if any(marker in combined for marker in clinical_markers):
        return "clinical"
    if label and label.lower().startswith(("table", "appendix")):
        return "unclear"
    return "unclear"


def table_candidate_confidence(label, title, table_text, row_count=0, column_count=0):
    metrics = table_text_metrics(table_text)
    confidence = 0.2
    if label:
        confidence += 0.18
    if title:
        confidence += 0.14
    if row_count >= 2:
        confidence += 0.16
    if row_count >= 4:
        confidence += 0.1
    if column_count >= 2:
        confidence += 0.16
    if column_count >= 3:
        confidence += 0.08
    if metrics["bars"] >= 8:
        confidence += 0.12
    if metrics["line_count"] >= 3:
        confidence += 0.08
    if metrics["clinical_score"] >= 3:
        confidence += 0.08
    return round(min(confidence, 0.99), 2)


def real_table_candidate(label, title, table_text, row_count=0, column_count=0):
    metrics = table_text_metrics(table_text)
    combined = " ".join([label or "", title or "", table_text or ""]).lower()
    known_table_heading = bool(label) or (title or "").lower() in (
        "roles and responsibilities",
        "recommended pharmacological treatment options",
    )

    if known_table_heading and metrics["line_count"] >= 2:
        return True
    if row_count >= 2 and column_count >= 2 and metrics["line_count"] >= 2:
        return True
    if metrics["bars"] >= 6 and metrics["line_count"] >= 3:
        return True
    if "role" in combined and "responsibility" in combined and metrics["line_count"] >= 3:
        return True
    if any(marker in combined for marker in ("version control", "authorisation date", "published date")):
        return metrics["line_count"] >= 3
    return False


def likely_table_candidates(page):
    candidates = []
    try:
        tables = page.find_tables()
        for index, table in enumerate(tables.tables):
            rect = fitz.Rect(table.bbox)
            payload = extract_table_payload(table)
            table_text = payload["text"]
            label, title, heading_text = nearby_table_heading(page, rect, table_text)
            row_count = payload["row_count"]
            column_count = payload["column_count"]
            if not real_table_candidate(label, title, table_text, row_count, column_count):
                continue
            role = table_role_for_candidate(label, title, table_text)
            candidates.append(
                {
                    "rect": rect,
                    "table_text": table_text,
                    "table_label": label,
                    "table_title": title,
                    "table_role": role,
                    "table_confidence": table_candidate_confidence(label, title, table_text, row_count, column_count),
                    "table_rows": payload.get("rows", []),
                    "table_columns": payload.get("columns", []),
                    "accessible_table_markdown": payload.get("accessible_markdown") or table_text,
                    "row_count": row_count,
                    "column_count": column_count,
                    "heading_text": heading_text,
                    "extraction_method": "pymupdf_find_tables",
                    "table_index": index + 1,
                }
            )
    except Exception:
        pass

    return candidates


def fallback_table_candidates(page, existing_rects):
    blocks = sorted(page.get_text("blocks") or [], key=lambda block: (block[1], block[0]))
    text_blocks = []
    for block in blocks:
        if len(block) < 5:
            continue
        rect = fitz.Rect(block[:4])
        raw_text = str(block[4])
        text = re.sub(r"\s+", " ", raw_text).strip()
        if not text or rect.height < 10:
            continue
        text_blocks.append((rect, text, raw_text))

    candidates = []
    active = []
    for rect, text, raw_text in text_blocks:
        score = clinical_table_score(text)
        has_columns = raw_text.count("  ") >= 2 or "\t" in raw_text or "|" in raw_text
        table_role = table_role_for_candidate(None, None, text)
        if score >= 2 or has_columns or table_role in ("admin", "reference"):
            active.append((rect, text))
            continue

        if active:
            candidates.extend(active)
            active = []
    if active:
        candidates.extend(active)

    if not candidates:
        return []

    rects = [rect for rect, _ in candidates]
    region = merge_rects(rects, page.rect)
    text = "\n".join(text for _, text in candidates)
    if not region:
        return []
    if any(rect_intersection_ratio(region, existing) > 0.45 for existing in existing_rects):
        return []

    label, title, heading_text = nearby_table_heading(page, region, text)
    inferred_columns = max((len(re.split(r"\s{2,}|\t|\|", line.strip())) for line in text.splitlines() if line.strip()), default=0)
    inferred_rows = len([line for line in text.splitlines() if line.strip()])
    rows = text_grid_rows(text)
    role = table_role_for_candidate(label, title, text)
    if not real_table_candidate(label, title, text, inferred_rows, inferred_columns):
        return []
    return [
        {
            "rect": region,
            "table_text": text[:MAX_TABLE_TEXT_CHARS],
            "table_label": label,
            "table_title": title,
            "table_role": role,
            "table_confidence": table_candidate_confidence(label, title, text, inferred_rows, inferred_columns),
            "table_rows": rows[:MAX_TABLE_ROWS],
            "table_columns": (rows[0] if rows else [])[:24],
            "accessible_table_markdown": table_rows_to_markdown(rows) if rows and max((len(row) for row in rows), default=0) > 1 else text[:MAX_TABLE_TEXT_CHARS],
            "row_count": inferred_rows,
            "rows_truncated": len(rows) > MAX_TABLE_ROWS or len(text) > MAX_TABLE_TEXT_CHARS,
            "column_count": inferred_columns,
            "heading_text": heading_text,
            "extraction_method": "text_grid_heuristic",
            "table_index": len(existing_rects) + 1,
        }
    ]


def merge_related_table_candidates(candidates, page_rect):
    if len(candidates) < 2:
        return candidates

    merged = []
    used = set()
    for index, candidate in enumerate(candidates):
        if index in used:
            continue

        label = (candidate.get("table_label") or "").lower()
        if not label.startswith("appendix"):
            merged.append(candidate)
            continue

        group = [candidate]
        for other_index, other in enumerate(candidates):
            if other_index == index or other_index in used:
                continue
            title = (other.get("table_title") or "").lower()
            text = (other.get("table_text") or "").lower()
            vertical_gap = other["rect"].y0 - candidate["rect"].y1
            if other["rect"].y0 >= candidate["rect"].y0 and vertical_gap < 160 and (
                "recommended pharmacological treatment options" in title
                or "maximum dose" in title
                or "intramuscular" in text
                or "benzodiazepine" in text
            ):
                group.append(other)
                used.add(other_index)

        if len(group) > 1:
            rect = merge_rects([item["rect"] for item in group], page_rect)
            merged_text = "\n\n".join(item.get("table_text") or "" for item in group).strip()
            merged_rows = []
            for item in group:
                merged_rows.extend(item.get("table_rows") or [])
            candidate = {
                **candidate,
                "rect": rect,
                "table_text": merged_text,
                "table_role": table_role_for_candidate(
                    candidate.get("table_label"),
                    candidate.get("table_title"),
                    merged_text,
                ),
                "table_confidence": max(item.get("table_confidence") or 0 for item in group),
                "table_rows": merged_rows[:MAX_TABLE_ROWS],
                "table_columns": (merged_rows[0] if merged_rows else candidate.get("table_columns") or [])[:24],
                "accessible_table_markdown": table_rows_to_markdown(merged_rows) if merged_rows else merged_text,
                "row_count": sum(item.get("row_count") or 0 for item in group),
                "rows_truncated": len(merged_rows) > MAX_TABLE_ROWS
                or any(item.get("rows_truncated") for item in group),
                "column_count": max(item.get("column_count") or 0 for item in group),
                "extraction_method": "merged_appendix_tables",
            }
        merged.append(candidate)
        used.add(index)

    return merged


def likely_vector_region(page):
    drawings = page.get_drawings()
    rects = []
    for drawing in drawings:
        rect = drawing.get("rect")
        if not rect:
            continue
        if rect.width < 40 or rect.height < 20:
            continue
        rects.append(rect)

    if len(rects) < 4:
        return None

    region = merge_rects(rects, page.rect)
    if not region:
        return None

    page_area = page.rect.width * page.rect.height
    region_area = region.width * region.height
    if region_area < page_area * 0.06 or region_area > page_area * 0.82:
        return None
    return region


def page_visual_weight(page):
    drawing_count = len(page.get_drawings())
    image_count = len(page.get_images(full=True))
    text_blocks = page.get_text("blocks") or []
    block_heights = [abs(block[3] - block[1]) for block in text_blocks if len(block) >= 4]
    tall_blocks = sum(1 for height in block_heights if height > 70)
    median_block_height = median(block_heights) if block_heights else 0
    return drawing_count + image_count * 4 + tall_blocks + (2 if median_block_height > 40 else 0)


def fallback_visual_region(page, image_coverage=0.0, ocr_used=False):
    if page_visual_weight(page) < 8 and image_coverage < 0.35 and not ocr_used:
        return None

    text = (page.get_text("text", sort=True) or "").lower()
    admin_markers = (
        "authorisation",
        "published date",
        "document owner",
        "version control",
        "relevant standards",
        "references",
        "compliance monitoring",
    )
    high_value_markers = (
        "dose",
        "intramuscular",
        "benzodiazepine",
        "antipsychotic",
        "lorazepam",
        "olanzapine",
        "score",
        "observation",
        "post im",
        "post po",
    )
    if any(marker in text for marker in ("relevant standards", "references", "document owner", "compliance monitoring")):
        return None
    if any(marker in text for marker in admin_markers) and not any(marker in text for marker in high_value_markers):
        return None
    if ("version control" in text or "authorisation date" in text) and "recommended pharmacological treatment options" not in text:
        return None

    top_margin = page.rect.height * 0.08
    bottom_margin = page.rect.height * 0.08
    return fitz.Rect(
        page.rect.x0 + page.rect.width * 0.04,
        page.rect.y0 + top_margin,
        page.rect.x1 - page.rect.width * 0.04,
        page.rect.y1 - bottom_margin,
    )


def extract(pdf_path, output_dir, budget=None):
    budget = budget or ExtractionBudget()
    os.makedirs(output_dir, exist_ok=True)
    document = fitz.open(pdf_path)
    pages = []
    images = []
    warnings = []
    budget.set_page_count(document.page_count)

    for page_index, page in enumerate(document):
        page_number = page_index + 1
        text = page.get_text("text", sort=True) or ""
        ocr_used = False
        needs_ocr = False
        image_coverage = page_image_coverage_ratio(page)

        # IDX-H4: trigger OCR by text-density relative to image coverage, not only a flat
        # 40-char floor. Image-dominant pages with low text density (e.g. a dose table
        # rendered as an image with a short caption) are OCR'd and merged with the existing
        # text layer so caption + table contents are both retained.
        if should_ocr_page(text, page):
            ocr_text, ocr_warning = maybe_ocr_page(page, budget)
            if ocr_warning:
                warnings.append(ocr_warning)
            if ocr_text.strip():
                text = merge_ocr_text(text, ocr_text)
                ocr_used = True
            else:
                needs_ocr = True

        budget.add_text(text)
        pages.append(
            {
                "pageNumber": page_number,
                "text": text,
                "ocrUsed": ocr_used,
                "needsOcr": needs_ocr,
                "metadata": {
                    "image_coverage_ratio": round(image_coverage, 4),
                },
            }
        )

        page_image_count = 0
        for image_index, image_info in enumerate(page.get_images(full=True)):
            xref = image_info[0]
            budget.ensure_artifact_slot()
            extracted = document.extract_image(xref)
            ext = extracted.get("ext", "png")
            image_bytes = extracted["image"]
            width = extracted.get("width")
            height = extracted.get("height")
            rects = page.get_image_rects(xref) or []
            bbox = rect_payload(rects[0]) if rects else None
            image_path = os.path.join(
                output_dir, f"page-{page_number}-image-{image_index + 1}.{ext}"
            )
            budget.add_artifact(len(image_bytes))
            with open(image_path, "wb") as handle:
                handle.write(image_bytes)

            mime = "image/jpeg" if ext.lower() in ("jpg", "jpeg") else f"image/{ext}"
            images.append(
                {
                    "pageNumber": page_number,
                    "path": image_path,
                    "mimeType": mime,
                    "bbox": bbox,
                    "width": width,
                    "height": height,
                    "sourceKind": "embedded",
                    "metadata": {
                        "pageNumber": page_number,
                        "source_kind": "embedded",
                        "xref": xref,
                        "bbox": bbox,
                        "page_width": round(float(page.rect.width), 2),
                        "page_height": round(float(page.rect.height), 2),
                        "page_rotation": int(page.rotation or 0),
                        "image_coverage_ratio": round(image_coverage, 4),
                        "source_regions": [
                            {
                                "source_kind": "embedded",
                                "bbox": bbox,
                                "page_number": page_number,
                                "xref": xref,
                            }
                        ],
                    },
                }
            )
            page_image_count += 1

        crop_index = 1
        table_rects = []
        table_candidates = likely_table_candidates(page)
        table_candidates.extend(fallback_table_candidates(page, [candidate["rect"] for candidate in table_candidates]))
        table_candidates = merge_related_table_candidates(table_candidates, page.rect)
        for table_candidate in table_candidates:
            table_rect = table_expanded_rect(table_candidate["rect"], page.rect)
            crop = save_page_crop(
                page,
                table_rect,
                output_dir,
                f"page-{page_number}-table-crop-{crop_index}.png",
                "table_crop",
                {
                    "pageNumber": page_number,
                    "source_kind": "table_crop",
                    "candidate_type": "table",
                    "table_label": table_candidate.get("table_label"),
                    "table_title": table_candidate.get("table_title"),
                    "table_text": (table_candidate.get("table_text") or "")[:MAX_TABLE_TEXT_CHARS],
                    "table_role": table_candidate.get("table_role"),
                    "table_confidence": table_candidate.get("table_confidence"),
                    "table_rows": table_candidate.get("table_rows") or [],
                    "table_columns": table_candidate.get("table_columns") or [],
                    "accessible_table_markdown": (table_candidate.get("accessible_table_markdown") or table_candidate.get("table_text") or "")[:MAX_TABLE_TEXT_CHARS],
                    "row_count": table_candidate.get("row_count"),
                    "rows_truncated": bool(table_candidate.get("rows_truncated")),
                    "column_count": table_candidate.get("column_count"),
                    "heading_text": table_candidate.get("heading_text"),
                    "bbox": rect_payload(table_rect),
                    "extraction_method": table_candidate.get("extraction_method"),
                    "table_index": table_candidate.get("table_index"),
                },
                budget,
                warnings,
            )
            if crop:
                images.append(crop)
                table_rects.append(table_rect)
                crop_index += 1

        vector_region = likely_vector_region(page)
        if vector_region and not any(rect_intersection_ratio(vector_region, table_rect) > 0.45 for table_rect in table_rects):
            crop = save_page_crop(
                page,
                vector_region,
                output_dir,
                f"page-{page_number}-vector-crop-{crop_index}.png",
                "diagram_crop",
                {
                    "pageNumber": page_number,
                    "source_kind": "diagram_crop",
                    "candidate_type": "vector_region",
                },
                budget,
                warnings,
            )
            if crop:
                images.append(crop)
                crop_index += 1

        should_capture_fallback_region = crop_index == 1 and (
            page_image_count == 0 or image_coverage >= 0.18 or ocr_used
        )
        if should_capture_fallback_region:
            fallback_region = fallback_visual_region(page, image_coverage=image_coverage, ocr_used=ocr_used)
            if fallback_region and not any(
                rect_intersection_ratio(fallback_region, table_rect) > 0.45 for table_rect in table_rects
            ):
                candidate_type = (
                    "ocr_page_region"
                    if ocr_used
                    else "image_dominant_page_region"
                    if page_image_count > 0
                    else "fallback_visual_region"
                )
                crop = save_page_crop(
                    page,
                    fallback_region,
                    output_dir,
                    f"page-{page_number}-visual-region.png",
                    "page_region",
                    {
                        "pageNumber": page_number,
                        "source_kind": "page_region",
                        "candidate_type": candidate_type,
                        "image_coverage_ratio": round(image_coverage, 4),
                        "page_visual_weight": page_visual_weight(page),
                        "ocr_used": ocr_used,
                  },
                    budget,
                    warnings,
                )
                if crop:
                    images.append(crop)

    return {
        "pages": pages,
        "images": images,
        "warnings": warnings,
        "budgetUsage": budget.usage(),
    }


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4, 5):
        print(
            "Usage: extract_pdf_assets.py input.pdf output_dir [output.json] [budget.json]",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        limits = None
        if len(sys.argv) == 5:
            with open(sys.argv[4], "r", encoding="utf-8") as handle:
                limits = json.load(handle)
        extraction_budget = ExtractionBudget(limits)
        result = extract(sys.argv[1], sys.argv[2], extraction_budget)
        serialized = json.dumps(result)
        extraction_budget.ensure_result(serialized)
        if len(sys.argv) >= 4:
            with open(sys.argv[3], "w", encoding="utf-8") as handle:
                handle.write(serialized)
        else:
            print(serialized)
    except ExtractionBudgetExceeded as exc:
        print(f"PDF_EXTRACTION_BUDGET_EXCEEDED: {exc}", file=sys.stderr)
        sys.exit(3)
