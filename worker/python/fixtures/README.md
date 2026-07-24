# PDF extraction fixtures

## `malformed-table-crop-page-edge.pdf`

Minimal authorised **synthetic** clinical-table PDF for outstanding issue `#076`.

- No patient identifiers, no third-party copyrighted content.
- A4 page (`595.28 × 841.89`), one titled 4-row table whose final row straddles the page bottom (`y0=824` … `y1=860`; page ends at `841.89`).
- Regenerated with PyMuPDF via the geometry constants pinned in `test_extract_pdf_assets_page_edge_crop.py`.

### Failing stage (pre-fix)

`page.find_tables()` (`extraction_method=pymupdf_find_tables`) returns a candidate bbox that ends at the last **fully** detected row (`y1=824`). Without extension, `expanded_rect(..., 4, 4)` yielded crop clip `[46, 712, 564, 828]`, so:

- ~14 px of still-on-page content for the straddling score-`5` row was omitted from the `table_crop` pixmap
- structured `table_rows` silently dropped that row
- no incompleteness warning was emitted

### Fix stage

`extend_table_rect_for_edge_content` grows the candidate using contiguous **cell drawings** toward the page edge, then `save_page_crop` renders the clamped remnant. Structured text in the extended strip is recovered when possible; page-clipped continuation sets `rows_truncated`, `crop_completeness=0.9`, and a `table_crop_edge_incomplete` warning.

### Expected geometry after the fix

- `table_crop.bbox[3]` (clip bottom) ≥ `page_height - 1`
- structured rows include the on-page remnant of score `5`, or incompleteness is marked
