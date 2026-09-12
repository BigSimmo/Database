# Font fixtures for the third edition harness

`check.mjs` and `shots.mjs` serve these files in place of the live Google Fonts requests the
mockups make, so a run is offline and gives the same answer every time.

`platinum.css` is the latin subset of the stylesheet the third edition asks for:

    https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap

Only the latin blocks are kept, because the mockups are English only. The three `.woff2` files
are the variable fonts that stylesheet points at, under their original names, since the harness
resolves a font request by its file name.

Source Serif 4, Source Sans 3 and JetBrains Mono are all published under the SIL Open Font
Licence 1.1, which permits redistribution: https://openfontlicense.org

To refresh them, fetch the stylesheet above, keep its `/* latin */` blocks, and download each
file it names into this directory.
