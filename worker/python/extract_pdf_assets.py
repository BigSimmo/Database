import io
import json
import os
import sys
from statistics import median

try:
    import fitz  # PyMuPDF
except Exception as exc:
    print(f"PyMuPDF is required for robust PDF extraction: {exc}", file=sys.stderr)
    sys.exit(2)


def maybe_ocr_page(page):
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

        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(image)
    except Exception:
        return ""


def rect_payload(rect):
    return [round(rect.x0, 2), round(rect.y0, 2), round(rect.x1, 2), round(rect.y1, 2)]


def write_pixmap(pix, path):
    pix.save(path)
    return {"width": pix.width, "height": pix.height}


def save_page_crop(page, rect, output_dir, file_name, source_kind, metadata):
    page_rect = page.rect
    clipped = rect & page_rect
    if clipped.is_empty:
        return None

    if clipped.width < 80 or clipped.height < 60:
        return None

    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clipped, alpha=False)
    if pix.width < 180 or pix.height < 120:
        return None

    image_path = os.path.join(output_dir, file_name)
    dimensions = write_pixmap(pix, image_path)
    return {
        "pageNumber": metadata["pageNumber"],
        "path": image_path,
        "mimeType": "image/png",
        "bbox": rect_payload(clipped),
        "width": dimensions["width"],
        "height": dimensions["height"],
        "sourceKind": source_kind,
        "metadata": metadata,
    }


def merge_rects(rects, page_rect):
    if not rects:
        return None
    x0 = max(min(rect.x0 for rect in rects) - 12, page_rect.x0)
    y0 = max(min(rect.y0 for rect in rects) - 12, page_rect.y0)
    x1 = min(max(rect.x1 for rect in rects) + 12, page_rect.x1)
    y1 = min(max(rect.y1 for rect in rects) + 12, page_rect.y1)
    return fitz.Rect(x0, y0, x1, y1)


def likely_table_rects(page):
    try:
        tables = page.find_tables()
        return [table.bbox for table in tables.tables]
    except Exception:
        return []


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


def fallback_visual_region(page):
    if page_visual_weight(page) < 8:
        return None

    top_margin = page.rect.height * 0.08
    bottom_margin = page.rect.height * 0.08
    return fitz.Rect(
        page.rect.x0 + page.rect.width * 0.04,
        page.rect.y0 + top_margin,
        page.rect.x1 - page.rect.width * 0.04,
        page.rect.y1 - bottom_margin,
    )


def extract(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    document = fitz.open(pdf_path)
    pages = []
    images = []

    for page_index, page in enumerate(document):
        page_number = page_index + 1
        text = page.get_text("text", sort=True) or ""
        ocr_used = False

        if len(text.strip()) < 40:
            ocr_text = maybe_ocr_page(page)
            if ocr_text.strip():
                text = ocr_text
                ocr_used = True

        pages.append(
            {
                "pageNumber": page_number,
                "text": text,
                "ocrUsed": ocr_used,
            }
        )

        page_image_count = 0
        for image_index, image_info in enumerate(page.get_images(full=True)):
            xref = image_info[0]
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
                    },
                }
            )
            page_image_count += 1

        crop_index = 1
        for table_rect in likely_table_rects(page):
            crop = save_page_crop(
                page,
                fitz.Rect(table_rect),
                output_dir,
                f"page-{page_number}-table-crop-{crop_index}.png",
                "diagram_crop",
                {
                    "pageNumber": page_number,
                    "source_kind": "diagram_crop",
                    "candidate_type": "table",
                },
            )
            if crop:
                images.append(crop)
                crop_index += 1

        vector_region = likely_vector_region(page)
        if vector_region:
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
            )
            if crop:
                images.append(crop)
                crop_index += 1

        if page_image_count == 0 and crop_index == 1:
            fallback_region = fallback_visual_region(page)
            if fallback_region:
                crop = save_page_crop(
                    page,
                    fallback_region,
                    output_dir,
                    f"page-{page_number}-visual-region.png",
                    "page_region",
                    {
                        "pageNumber": page_number,
                        "source_kind": "page_region",
                        "candidate_type": "fallback_visual_region",
                    },
                )
                if crop:
                    images.append(crop)

    return {"pages": pages, "images": images, "warnings": []}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: extract_pdf_assets.py input.pdf output_dir", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(extract(sys.argv[1], sys.argv[2])))
