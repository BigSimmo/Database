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

## Construction

Work in **glyph units**: the S is exactly 100 units tall and 54.8 wide, with its top-left corner at
the origin. The whole mark is one stroke plus a 180° rotation of that same stroke about the point
**(27.4, 50)**.

### The stroke

Six circular arcs, in order around the outline:

| #   | Arc           | Centre         | Radius | Role                                    |
| --- | ------------- | -------------- | ------ | --------------------------------------- |
| 1   | Head terminal | (38.66, 3.37)  | 2.0    | rounded tip of the head                 |
| 2   | Throat        | (44.20, 20.50) | 16.0   | the scoop under the head                |
| 3   | Elbow         | (24.13, 34.55) | 8.5    | the outward flick into the tail         |
| 4   | Tail inner    | (51.95, 64.67) | 32.5   | the long inner sweep of the tail        |
| 5   | Tail terminal | (18.53, 55.33) | 2.2    | rounded tip of the tail                 |
| 6   | Outer sweep   | (30.00, 30.00) | 30.0   | the whole outer edge, head back to tail |

Arcs 2, 3 and 4 are mutually tangent: the distance between the centres of 2 and 3 equals
16.0 + 8.5, and between 3 and 4 equals 8.5 + 32.5. The two terminals are each tangent internally to
arc 6 and externally to their neighbour, which is what makes the tips round rather than pointed.

**Adjusting the weight.** One number controls how heavy the stroke is: shift the inner boundary
outward by `d` by setting radius 2 to `17.5 − d`, radius 3 to `7.0 + d`, and radius 4 to `34.0 − d`.
Tangency survives automatically, because the three constraints only involve sums of consecutive
radii. The primary mark uses **d = 1.5**.

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
a separate optical cut for that range: weight `d = 0.6` and rotation centre `(28.2, 50)`, which
opens the channel by 60% while widening the silhouette by only 3%, and it drops the two blue points
and enlarges the S. Use it for favicons, browser tabs, and anything rendered under 32 px.

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
