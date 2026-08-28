# The PsychSift logo

The files in `public/brand/` are the master artwork. They are true vectors — every curve is a
circular arc with an exact centre and radius, so the mark is identical at 16 px and at billboard
size, and the primary file is 850 bytes.

This page records **how the mark is built**, so it can be rebuilt or extended without guessing.

## What the mark is

A rounded navy tile carrying an **S** made of two counter-turning strokes, with a single white
point settled to the upper right.

The S is the initial of _Sift_ and reads as two halves of one judgement. The point is what has been
sifted out and come to rest.

An earlier version of these files carried two small blue points falling below the white one. They
have been removed at the owner's direction, and the mark is now a single colour on its tile.

## Provenance

The mark was drawn from the original PsychSift brand sheet. The mark on that sheet is the
authoritative design; the large blue raster that circulated alongside it is a low-fidelity
enlargement and must not be used.

The geometry here was measured from a high-resolution view of the original, arc by arc, at the
**50% level of its anti-aliased edges** — the one place on a blurred edge that is not biased by the
blur. Each arc was then fitted on its own, so its residual could be inspected rather than hidden in
an aggregate: per-arc RMS runs from 0.05 to 0.14 units in 100. The finished mark covers 94.7% of
the original by area (intersection over union), against 94.1% for the previous cut and 84.8% for
the draft before that.

Three earlier drafts got this wrong in instructive ways, and every error came from trusting a
measurement that the source could not actually support.

**The terminals are sharp.** At the size the original was first sampled, a sharp point blurs into a
rounded blob. The first draft fitted that blur and gave the mark rounded club-ends. Both tips are
genuine cusps: the outer edge runs into the inner edge and the crossing is the point.

**The tail leaves the main sweep.** The second draft modelled each stroke as four arcs, with the
whole outer edge on one circle. It is not: below about two-thirds of the way down, the outer edge
peels away from that circle and hooks further out — by three full units at the very tip. That hook
is what draws the tail into a long fine point, and without it the tail stops short and the stroke
reads heavy. Fitting by nearest-point distance had hidden this, because every point on a slightly
wrong outline still sits close to _some_ point of the right one. Comparing coverage against the
original's grey levels showed it immediately.

**The middle line is one system, not two.** The third draft drew each stroke's facing edge from
its own circle: the upper stroke's curved one way, the lower stroke's the other. Two arcs bowing
apart open a lens-shaped gap between them, and the channel swelled from 5.4 units at its ends to
8.6 in the middle — a visible dip in what should read as a single clean line. Measuring the
original across the channel settles it: its gap is **4.75 units wide with a standard deviation of
0.25**, which is to say constant. Both of its edges are arcs of the same circle, one inside the
other. The mark is now built that way, and its gap measures 4.75 with a standard deviation of
0.10 — steadier than the original it was taken from.

Two things were corrected, and one apparent oddity was kept.

**Corrected.** The glyph is centred in its tile; the original sat hard against the right edge. And
every junction between arcs is tangent-continuous, so enlarging the mark reveals no kink.

**Kept.** The second stroke's outer silhouette is drawn **7% larger** than the first's. Forcing the
two to be identical measurably worsens the match and opens up the channel between them, which is the
tension the mark depends on. A further 3.5° rotation improves the fit by another half a percent; it
was left out deliberately, because an arbitrary tilt is not something a logo specification should
carry.

## Construction

Work in **glyph units**: the S is exactly 100 units tall and 55.10 wide, with its top-left corner
at the origin.

### The middle line

The gap between the two strokes is defined **once**, by a single circle:

|                            |                    |
| -------------------------- | ------------------ |
| Centre                     | (89.7175, 83.5939) |
| Upper stroke's facing edge | radius 74.8165     |
| Lower stroke's facing edge | radius 70.0627     |

Because both edges are arcs of the same centre, the gap is **4.7537 units wide along its whole
length** and both edges curve the same way. Everything else in the mark is built to meet those two
arcs tangentially. This is the part to protect: draw the two facing edges from separate circles and
the gap opens into a lens, which is what the previous cut did.

### The upper stroke

Four circular arcs, meeting at two tangent points and two sharp cusps:

| Arc         | Centre             | Radius  | Role                                             |
| ----------- | ------------------ | ------- | ------------------------------------------------ |
| Outer sweep | (29.2009, 29.2009) | 29.2009 | the outer edge, from the head to two-thirds down |
| Tail-outer  | (51.5937, 16.1418) | 55.1234 | the hook that draws the tail to a point          |
| Throat      | (44.8724, 20.0286) | 17.7232 | the scoop under the head                         |
| Blend       | (23.9407, 34.1024) | 7.5     | turns the throat into the facing edge            |
| Facing edge | (89.7175, 83.5939) | 74.8165 | the upper side of the middle line                |

- **Head cusp** at (41.3675, 2.6554) — outer sweep into throat.
- **Tail cusp** at (18.6157, 60.3124) — facing edge into tail-outer.
- **Tangent points** at (3.9761, 43.9116) outer sweep into tail-outer, (30.1646, 29.9176) throat
  into blend, and (29.9337, 38.6117) blend into facing edge.

The outer sweep is centred at (r, r) for its own radius, so it is tangent to both the top and the
left edge of the stroke's bounding box. That relationship fell out of the fit rather than being
imposed, and it is the quickest way to check a redraw.

The blend exists because the throat and the facing edge are both concave and too far apart to meet
directly. The original resolved that with a 2.88-unit flick, which is tight enough to read as a
corner; 7.5 units reads as a curve. It is the one place in the mark where the edge turns over
twice, and it is unavoidable.

### The lower stroke

The outer silhouette is the upper stroke's, point-reflected and enlarged 7%:

```
translate(55.1029 100.3813) scale(-1.07)
```

A negative uniform scale is a 180° rotation and a 7% enlargement in one step. That gives:

| Arc         | Centre             | Radius  | Role                                  |
| ----------- | ------------------ | ------- | ------------------------------------- |
| Outer sweep | (23.8579, 69.1363) | 31.2450 | the outer edge                        |
| Tail-outer  | (−0.1024, 83.1096) | 58.9820 | the hook into the tail                |
| Throat      | (7.0894, 78.9507)  | 18.9638 | the scoop under the head              |
| Blend       | (34.7205, 64.9764) | 12.0    | turns the throat into the facing edge |
| Facing edge | (89.7175, 83.5939) | 70.0627 | the lower side of the middle line     |

- **Head cusp** at (10.8397, 97.5400) — outer sweep into throat.
- **Tail cusp** at (37.0958, 37.3365) — facing edge into tail-outer.
- **Tangent points** at (50.8485, 53.3959) outer sweep into tail-outer, (24.0121, 70.3921) throat
  into blend, and (23.3541, 61.1286) blend into facing edge.

The facing edge is **not** the reflection of the upper stroke's — it is the inner arc of the same
channel circle. That is the whole point of the change, and it is why the lower stroke's inner edge
has to be listed rather than derived.

### The point

A circle of radius **10.2165** centred at **(58.9234, 16.5279)**.

With the point included, the glyph spans 0 to 69.14 horizontally and 0 to 100.38 vertically.

### The tile

A square with a corner radius of **3/16 of its side** (18.75%). The glyph is scaled to **80% of the
tile height** and placed so that a point 46% of the way from the S's own centre toward the glyph's
right edge lands on the tile centre. That weighting stops the light single point from dragging the
heavy S off to the left.

### Small sizes

At 32 px and below the 4.75-unit channel closes up. `psychsift-favicon.svg` is a separate optical
cut for that range: the channel is widened to **7.75 units** by moving each facing edge 1.5 units
away from the other, and the two arcs are re-solved against the strokes they meet. Because only the
facing edges move, the outer silhouette is byte-for-byte the one in the primary file. Use it for
favicons, browser tabs, and anything rendered under 32 px.

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
