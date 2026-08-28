# The PsychSift logo

The files in `public/brand/` are the master artwork. They are true vectors — every curve is a
circular arc with an exact centre and radius, so the mark is identical at 16 px and at billboard
size, and the primary file is under 1 KB.

This page records **how the mark is built**, so it can be rebuilt or extended without guessing.

## What the mark is

A rounded navy tile carrying an **S** made of two counter-rotating strokes, with a trail of three
points falling away to the right: one large white point, then two smaller blue ones.

The S is the initial of _Sift_ and reads as two halves of one judgement. The falling points are
evidence being sifted — graded, settling, ordered. The larger white point has come to rest; the two
blue ones are still moving.

## Provenance

The mark was drawn from the original PsychSift brand sheet. The small white-on-navy mark on that
sheet is the authoritative design; the large blue raster that circulated alongside it is a
low-fidelity enlargement and must not be used.

Measuring the original showed the design is genuinely circle-based — the outer sweep of each
stroke sits on a circle of radius 30 (in the units below) to within a quarter of a unit across its
whole length. This vector reconstructs those circles exactly rather than tracing the raster.

Three deliberate corrections were made to the original:

1. **The two strokes are now exact 180° rotations of each other.** In the raster the lower stroke
   was noticeably heavier than the upper one, and irregularly so. Making them identical is what
   turns the mark into a system rather than a drawing.
2. **The glyph is centred in the tile.** The original sat hard against the right edge (a 26% margin
   on the left against 9% on the right).
3. **Every junction is tangent-continuous.** Consecutive arcs share a tangent at their meeting
   point, so there is no visible kink at any size.

**The terminals are sharp, and that matters.** Both tips of each stroke come to a genuine point —
a cusp, where the outer sweep runs into the inner edge. At the size the original was drawn, a sharp
point blurs into a rounded blob, and an earlier pass of this file was fitted to that blur and gave
the mark rounded club-ends. It was wrong: enlarging the original shows a clean horn at the head and
a taper at the tail. Nothing is rounded off here.

## Construction

Work in **glyph units**: the S is exactly 100 units tall and 54.8 wide, with its top-left corner at
the origin. The whole mark is one stroke plus a 180° rotation of that same stroke about the point
**(27.4, 50)**.

### The stroke

Four circular arcs, meeting at two tangent points and two sharp cusps:

| Arc         | Centre         | Radius | Role                                     |
| ----------- | -------------- | ------ | ---------------------------------------- |
| Outer sweep | (30.00, 30.00) | 30.0   | the whole outer edge, head round to tail |
| Throat      | (46.25, 20.45) | 20.0   | the scoop under the head                 |
| Elbow       | (27.49, 35.74) | 4.2    | the outward flick into the tail          |
| Tail inner  | (59.30, 67.85) | 41.0   | the long inner sweep of the tail         |

- **Head cusp** at (39.6152, 1.5826) — where the outer sweep meets the throat.
- **Tail cusp** at (19.4776, 58.0941) — where the tail inner arc meets the outer sweep.
- **Tangent points** at (30.7462, 33.0846), throat into elbow, and (30.4462, 38.7217), elbow into
  tail.

The elbow is not a free choice: its centre is _derived_ from tangency to its two neighbours, so
the distance from the throat's centre to it equals 20.0 + 4.2, and from it to the tail's centre
equals 4.2 + 41.0. Change any radius and the elbow relocates so both tangencies still hold exactly.

**Adjusting the weight.** The tail radius is the control. Shrinking it thickens the tail and
narrows the navy channel between the two strokes; the head cusp does not move, because only the
throat radius decides where that lands. At 41.0 the narrowest point of the channel is 5.8 units,
which matches the original.

### The point trail

| Point   | Centre       | Radius | Colour     |
| ------- | ------------ | ------ | ---------- |
| Settled | (58.8, 17.0) | 10.0   | white      |
| Falling | (71.5, 53.5) | 7.0    | brand blue |
| Falling | (71.5, 71.5) | 5.6    | brand blue |

The full glyph — S plus trail — spans 0 to 78.5 horizontally and 0 to 100 vertically.

### The tile

A square with a corner radius of **3/16 of its side** (18.75%). The glyph is scaled to **82% of the
tile height** and placed so that a point 42% of the way from the S's own centre toward the glyph's
right edge lands on the tile centre. That weighting stops the light point trail from dragging the
heavy S off to the left.

### Small sizes

At 32 px and below, the navy channel between the two strokes closes up. `psychsift-favicon.svg` is
a separate optical cut for that range: the tail radius opens out to 43.5 and the rotation centre
moves to (28.0, 50), which doubles the channel to 11.6 units while widening the silhouette by only
2%. It also drops the two blue points and enlarges the S. Use it for favicons, browser tabs, and
anything rendered under 32 px.

## Colours

| Name       | Hex       | Use                                 |
| ---------- | --------- | ----------------------------------- |
| Deep Navy  | `#0D1B2A` | tile, and the S on light grounds    |
| Brand Blue | `#2563EB` | the two falling points              |
| White      | `#FFFFFF` | the S and the settled point on navy |
| Light Blue | `#EAF2FF` | the falling points on a blue tile   |
| Cool Gray  | `#F2F4F7` | the light tile                      |

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
| `psychsift-glyph-white.svg`               | glyph alone, white S, no tile                        |
| `psychsift-glyph-navy.svg`                | glyph alone, navy S, no tile                         |
| `psychsift-glyph-mono.svg`                | glyph alone in `currentColor`, one colour throughout |
| `psychsift-lockup-horizontal.svg`         | mark plus wordmark, for light backgrounds            |
| `psychsift-lockup-horizontal-reverse.svg` | the same for dark backgrounds                        |
| `psychsift-lockup-horizontal-tagline.svg` | with "CLARITY. EVIDENCE. BETTER CARE."               |
| `psychsift-lockup-stacked.svg`            | mark above wordmark, for narrow spaces               |
| `psychsift-wordmark.svg`                  | wordmark alone                                       |
| `psychsift-mark-1024.png`                 | raster export, where SVG is not accepted             |
| `psychsift-mark-maskable-1024.png`        | raster export of the maskable icon                   |

## Using it

- **Clear space**: keep a margin of at least one quarter of the mark's height on every side.
- **Never** recolour the S, re-space the point trail, stretch the mark non-uniformly, add a shadow
  or gradient, or place the full-colour mark on a mid-tone background — use the light or reverse
  file instead.
- **Never** re-trace a PNG export. Start from the SVG.
- The mark carries `role="img"` and a `<title>`, so it is announced as "PsychSift" when inlined.
  When it sits next to the word PsychSift, mark it `aria-hidden` instead so screen readers do not
  say the name twice.

## Two things still open

- The brand sheet gives two different taglines: "Clarity. Evidence. Better care." in the header and
  "Clinical clarity. Evidence. Better care." in the footer. The lockup uses the first.
- The sheet specifies Inter throughout; the application uses Geist. That difference should be
  settled deliberately rather than left to drift.
