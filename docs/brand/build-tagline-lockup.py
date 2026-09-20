# -*- coding: utf-8 -*-
"""Set the strapline in `public/brand/psychsift-lockup-horizontal-tagline.svg`.

    python3 docs/brand/build-tagline-lockup.py            # rewrite the lockup in place
    python3 docs/brand/build-tagline-lockup.py --check     # fail if the file is stale

The strapline is outlined letterforms, not live text, so changing the words means
re-outlining them. This script does that from the repository's own Inter variable
font, and touches nothing else in the file: the tile, the mark and the wordmark
are spliced through byte for byte.

How the line is set, measured off the original artwork (see psychsift-logo.md):

  face        Inter, weight 600, from docs/brand/fonts/inter-latin.woff2
  cap height  25.8 units, the same as the line it replaces
  baseline    y = 229.3914, unchanged
  width       tracked so the ink finishes flush with the wordmark at both ends,
              which is the lockup's defining alignment
  colour      #2563EB, the standalone artwork's accent

Requires `fonttools` and `brotli` (the font is woff2-compressed).
"""
import re
import sys
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "docs/brand/fonts/inter-latin.woff2"
LOCKUP = ROOT / "public/brand/psychsift-lockup-horizontal-tagline.svg"

STRAPLINE = "FROM QUESTION TO SOURCE"
WEIGHT = 600
CAP_HEIGHT = 25.8
BASELINE_Y = 229.3914
INK_LEFT = 312.3231  # page x where the wordmark's ink starts
INK_WIDTH = 614.4900  # the wordmark's ink width; the strapline matches it exactly
FILL = "#2563EB"
DESC = "The PsychSift horizontal lockup with the strapline From question to source."

# The <g> that holds the strapline: the second translated text group in the file.
GROUP_RE = re.compile(r'(<g transform="translate\()[-\d.]+ [-\d.]+(\)">)<path d="[^"]+" fill="#2563EB"\s*/></g>')
DESC_RE = re.compile(r"<desc>[^<]*</desc>")


def font():
    return instancer.instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT}, inplace=False)


def set_line(text):
    """Return (path_d, translate_x) for `text` set to the measurements above."""
    f = font()
    glyphs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    upem = f["head"].unitsPerEm
    cap = BoundsPen(glyphs)
    glyphs[cmap[ord("E")]].draw(cap)
    size = CAP_HEIGHT * upem / (cap.bounds[3] - cap.bounds[1])
    scale = size / upem

    def run(tracking):
        """Walk the string once; return each glyph's pen x plus the ink extent."""
        x, pens, lo, hi = 0.0, [], None, None
        for ch in text:
            name = cmap[ord(ch)]
            if ch != " ":
                bounds = BoundsPen(glyphs)
                glyphs[name].draw(TransformPen(bounds, Transform().translate(x, 0).scale(scale, -scale)))
                if bounds.bounds:
                    lo = bounds.bounds[0] if lo is None else min(lo, bounds.bounds[0])
                    hi = bounds.bounds[2] if hi is None else max(hi, bounds.bounds[2])
                pens.append((name, x))
            x += hmtx[name][0] * scale + tracking
        return pens, lo, hi

    _, lo, hi = run(0.0)
    tracking = (INK_WIDTH - (hi - lo)) / (len(text) - 1)
    pens, lo, _ = run(tracking)

    parts = []
    for name, x in pens:
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        glyphs[name].draw(TransformPen(pen, Transform().translate(x, 0).scale(scale, -scale)))
        if pen.getCommands():
            parts.append(pen.getCommands())
    return " ".join(parts), INK_LEFT - lo


def rewrite(svg):
    d, tx = set_line(STRAPLINE)
    group = f'<g transform="translate({tx:.4f} {BASELINE_Y})"><path d="{d}" fill="{FILL}"/></g>'
    if not GROUP_RE.search(svg):
        sys.exit("strapline group not found — the lockup's structure has changed")
    return DESC_RE.sub(f"<desc>{DESC}</desc>", GROUP_RE.sub(lambda _: group, svg, count=1), count=1)


def main():
    current = LOCKUP.read_text(encoding="utf-8")
    updated = rewrite(current)
    if "--check" in sys.argv:
        if current != updated:
            sys.exit(f"{LOCKUP.relative_to(ROOT)} is stale — run: python3 {Path(__file__).relative_to(ROOT)}")
        print(f"ok: {LOCKUP.relative_to(ROOT)} matches the strapline {STRAPLINE!r}")
        return
    LOCKUP.write_text(updated, encoding="utf-8")
    print(f"wrote {LOCKUP.relative_to(ROOT)} — {STRAPLINE!r}")


if __name__ == "__main__":
    main()
