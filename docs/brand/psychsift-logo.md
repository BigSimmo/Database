# The PsychSift logo

The files in `public/brand/` are the master artwork. They are true vectors — every curve is a
circular arc with an exact centre and radius, so the mark is identical at 16 px and at billboard
size, and the primary file is 814 bytes.

This page records **how the mark is built**, so it can be rebuilt or extended without guessing.

## What the mark is

A rounded navy tile carrying an **S** made of two counter-turning strokes, with a single white
point settled to the upper right.

The S is the initial of _Sift_ and reads as two halves of one judgement. The point is what has been
sifted out and come to rest.

An earlier version of these files carried two small blue points falling below the white one. They
have been removed at the owner's direction, and the mark is now a single colour on its tile.

## Provenance

The mark was drawn from the original PsychSift brand sheet. The small white-on-navy mark on that
sheet is the authoritative design; the large blue raster that circulated alongside it is a
low-fidelity enlargement and must not be used.

The geometry here was fitted to a high-resolution view of the original at sub-pixel accuracy. The
fit is a **root-mean-square error of 0.33 units in 100** against the measured outline — well inside
the softness of the source. Measuring at that resolution showed the design is genuinely
circle-based, which is why it reconstructs cleanly.

Two things were corrected, and one apparent oddity was deliberately kept.

**Corrected.** The glyph is now centred in its tile; the original sat hard against the right edge.
And every junction between arcs is tangent-continuous, so enlarging the mark reveals no kink.

**Kept.** The lower stroke is drawn **6% larger** than the upper one. That is not a mistake in the
original and not noise: fitting each stroke separately, and then fitting a single rotation-plus-scale
between them, both land on the same answer. Forcing the two strokes to be identical measurably
worsens the match to the original and visibly opens up the channel between them, which is the
tension the mark depends on. So the mark is one master stroke placed twice, at two sizes.

**A note on the terminals.** Both tips of each stroke come to a genuine point — a cusp, where the
outer sweep runs into the inner edge. At the size the original was drawn, a sharp point blurs into
a rounded blob, and an earlier pass of this file was fitted to that blur and gave the mark rounded
club-ends. It was wrong. Nothing here is rounded off.

## Construction

Work in **glyph units**: the S is exactly 100 units tall and 54.84 wide, with its top-left corner
at the origin.

### The master stroke

Four circular arcs, meeting at two tangent points and two sharp cusps:

| Arc         | Centre           | Radius | Role                                     |
| ----------- | ---------------- | ------ | ---------------------------------------- |
| Outer sweep | (30.567, 30.567) | 30.567 | the whole outer edge, head round to tail |
| Throat      | (46.447, 20.746) | 19.061 | the scoop under the head                 |
| Elbow       | (29.974, 34.186) | 2.199  | the flick into the tail                  |
| Tail inner  | (60.692, 67.165) | 42.870 | the long inner sweep of the tail         |

- **Head cusp** at (41.9881, 2.2139) — where the outer sweep meets the throat.
- **Tail cusp** at (18.6620, 58.7204) — where the tail inner arc meets the outer sweep.
- **Tangent points** at (31.6779, 32.7957), throat into elbow, and (31.4729, 35.7950), elbow into
  tail.

Two facts make the construction self-checking. The outer sweep is centred at (r, r) for its own
radius, so it is tangent to both the top and the left edge of the stroke's bounding box. And the
elbow's centre is not a free choice — it is _derived_ from tangency to its two neighbours, so the
distance from the throat's centre to it equals 19.061 + 2.199, and from it to the tail's centre
equals 2.199 + 42.870. Change any radius and the elbow relocates so both tangencies still hold
exactly.

### The second stroke

The same path, transformed:

```
translate(54.84 100) scale(-1.06)
```

A negative uniform scale is a 180° rotation and a 6% enlargement in one step. The offset places the
enlarged stroke so the pair fills the box (0, 0) to (54.84, 100) exactly. At their closest the two
strokes are 4.0 units apart — that narrow diagonal channel is the whole character of the mark.

### The point

A circle of radius **10.349** centred at **(58.672, 17.175)**.

With the point included, the glyph spans 0 to 69.02 horizontally and 0 to 100 vertically.

### The tile

A square with a corner radius of **3/16 of its side** (18.75%). The glyph is scaled to **80% of the
tile height** and placed so that a point 46% of the way from the S's own centre toward the glyph's
right edge lands on the tile centre. That weighting stops the light single point from dragging the
heavy S off to the left.

### Small sizes

At 32 px and below, the 4-unit channel between the two strokes closes up. `psychsift-favicon.svg`
is a separate optical cut for that range: the second stroke's offset moves out by 3.5 units in both
directions, which widens the channel to 8.9 units — more than double — while changing the
silhouette's proportion by 3%. Use it for favicons, browser tabs, and anything rendered under 32 px.

## Colours

| Name       | Hex       | Use                                  |
| ---------- | --------- | ------------------------------------ |
| Deep Navy  | `#0D1B2A` | the tile; and the S on light grounds |
| White      | `#FFFFFF` | the S and the point, on navy         |
| Brand Blue | `#2563EB` | the blue tile; the lockup tagline    |
| Cool Gray  | `#F2F4F7` | the light tile                       |

## The wordmark

**Inter Display SemiBold**, tracked −0.02 em. The outlines are embedded as paths, so the lockups
render identically without Inter installed. Inter is licensed under the SIL Open Font License 1.1.

In the lockups the wordmark cap height is 42% of the mark's height, set one fifth of the mark's
height to its right, with the cap-height centre aligned to the mark's centre. In the tagline
version the tagline is tracked out to finish flush with the wordmark.

Note that the running application currently sets its interface in **Geist**, not Inter. The
wordmark is outlined artwork and is unaffected, but a wordmark set live in Geist would not match.

## The files

| File                                      | Use                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| `psychsift-mark.svg`                      | primary mark, navy tile                              |
| `psychsift-mark-blue.svg`                 | on brand blue                                        |
| `psychsift-mark-light.svg`                | on a light tile, for pale backgrounds                |
| `psychsift-mark-maskable.svg`             | full-bleed square for PWA and Android adaptive icons |
| `psychsift-favicon.svg`                   | small-size optical cut, 32 px and below              |
| `psychsift-glyph-white.svg`               | glyph alone, white, no tile                          |
| `psychsift-glyph-navy.svg`                | glyph alone, navy, no tile                           |
| `psychsift-glyph-mono.svg`                | glyph alone in `currentColor`                        |
| `psychsift-lockup-horizontal.svg`         | mark plus wordmark, for light backgrounds            |
| `psychsift-lockup-horizontal-reverse.svg` | the same for dark backgrounds                        |
| `psychsift-lockup-horizontal-tagline.svg` | with "CLARITY. EVIDENCE. BETTER CARE."               |
| `psychsift-lockup-stacked.svg`            | mark above wordmark, for narrow spaces               |
| `psychsift-wordmark.svg`                  | wordmark alone                                       |
| `psychsift-mark-1024.png`                 | raster export, where SVG is not accepted             |
| `psychsift-mark-maskable-1024.png`        | raster export of the maskable icon                   |

## Using it

- **Clear space**: keep a margin of at least one quarter of the mark's height on every side.
- **Never** re-space the two strokes, stretch the mark non-uniformly, add a shadow or gradient, or
  place the full-colour mark on a mid-tone background — use the light or reverse file instead.
- **Never** re-trace a PNG export. Start from the SVG.
- The mark carries `role="img"` and a `<title>`, so it is announced as "PsychSift" when inlined.
  When it sits next to the word PsychSift, mark it `aria-hidden` instead so screen readers do not
  say the name twice.

## Two things still open

- The brand sheet gives two different taglines: "CLARITY. EVIDENCE. BETTER CARE." in the header and
  "Clinical clarity. Evidence. Better care." in the footer. The lockup uses the first.
- The sheet specifies Inter throughout; the application uses Geist. That difference should be
  settled deliberately rather than left to drift.
