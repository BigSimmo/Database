# PDF extraction fixtures

## `malformed-table-crop-page-edge.pdf`

Minimal authorised **synthetic** clinical-table PDF for outstanding issue `#076`.

- No patient identifiers, no third-party copyrighted content.
- A4 page (`595.28 × 841.89`), one titled 4-row table whose final row straddles the page bottom (`y0=824` … `y1=860`; page ends at `841.89`).
- Regenerated with PyMuPDF via the geometry constants pinned in `test_extract_pdf_assets_page_edge_crop.py`.

### Failing stage (current `main`)

`page.find_tables()` (`extraction_method=pymupdf_find_tables`) returns a candidate bbox that ends at the last **fully** detected row (`y1=824`). `expanded_rect(..., 4, 4)` then yields crop clip `[46, 712, 564, 828]`, so:

- ~14 px of still-on-page content for the straddling score-`5` row is omitted from the `table_crop` pixmap
- structured `table_rows` silently drops that row
- no `crop_completeness` / incompleteness warning is emitted before `save_page_crop`

### Expected geometry after a fix

- `table_crop.bbox[3]` (clip bottom) ≥ `page_height - 1` **or** an explicit incompleteness signal (`crop_completeness < 1` / warning) when on-page remnant cannot be recovered
- structured rows either include the on-page remnant of score `5`, or the incomplete extraction is marked so retention/viewer code can treat it as cut-off
