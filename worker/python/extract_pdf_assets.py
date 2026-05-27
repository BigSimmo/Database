import io
import json
import os
import sys

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

        for image_index, image_info in enumerate(page.get_images(full=True)):
            xref = image_info[0]
            extracted = document.extract_image(xref)
            ext = extracted.get("ext", "png")
            image_bytes = extracted["image"]
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
                    "bbox": None,
                }
            )

    return {"pages": pages, "images": images, "warnings": []}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: extract_pdf_assets.py input.pdf output_dir", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(extract(sys.argv[1], sys.argv[2])))
