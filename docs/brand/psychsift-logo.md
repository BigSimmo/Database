# The PsychSift logo

The files in `public/brand/` are the master artwork. They are true vectors — every curve is a
circular arc with an exact centre and radius, so the mark is identical at 16 px and at billboard
size, and the primary file is 863 bytes.

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
an aggregate: per-arc RMS runs from 0.05 to 0.14 units in 100. Outside the middle the mark covers 94% of
the original by area (intersection over union); the middle departs from the original on purpose.

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

**The middle line is one straight cut.** Two drafts got this wrong in the same way. The first drew
each stroke's facing edge from its own circle, curving opposite ways; two arcs bowing apart open a
lens, and the gap swelled from 5.4 units at its ends to 8.6 in the middle. The second made both
edges arcs of a single circle, which fixed the width but left each stroke reaching its edge through
a tight 7.5-unit blend that reads as a knuckle on the spine of the S.

The mark now does the simplest thing instead: the two strokes are divided by **one straight line**,
and each stroke's facing edge is that line offset by half the gap. The two edges are therefore
exactly parallel — the gap is one width down its whole length, and neither edge can curve against
the other. Each stroke joins its edge with a single 13-unit blend under the head, and both blends
bend the same way, away from the other stroke. Nothing on either facing edge turns over.

This is a deliberate improvement on the original rather than a copy of it. The original's channel
is 4.75 units wide with a standard deviation of 0.25 and bows by 1.25 units along its length; this
one is 4.35 with a standard deviation of 0.28 and does not bow at all.

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

The two strokes are divided by **one straight line**:

|                            |                                |
| -------------------------- | ------------------------------ |
| A point on it              | (26.2380, 48.6900)             |
| Unit normal                | (0.87626, 0.48184)             |
| Direction                  | 118.806°                       |
| Upper stroke's facing edge | the line at normal·x = 44.6629 |
| Lower stroke's facing edge | the line at normal·x = 48.8629 |

The two edges are the same line offset ±2.1 units, so they are exactly parallel: the gap is
**4.2 units wide down its whole length** and neither edge curves against the other. Everything else
in the mark is built to meet those two lines tangentially.

The cut sits where it does for a reason: at normal·x = 44.6629 the point reflection that makes the
second stroke carries the **upper stroke's facing edge exactly onto the lower one**. The whole mark
is therefore invariant under that single transform, and the second stroke can be — and is — written
as a transform of the first rather than as its own path. If the gap changes, this position has to be
re-solved from `(normal·origin − gap) / 2.07`; it is not a free number.

This is the part to protect. Give the two facing edges separate curves and the gap opens into a
lens; that is what the first two cuts of these files did.

### The upper stroke

Three arcs and one straight segment, meeting at two tangent points and two sharp cusps:

| Segment     | Centre             | Radius   | Role                                             |
| ----------- | ------------------ | -------- | ------------------------------------------------ |
| Outer sweep | (29.2009, 29.2009) | 29.2009  | the outer edge, from the head to two-thirds down |
| Tail hook   | (51.5937, 16.1418) | 55.1234  | the hook that draws the tail to a point          |
| Throat      | (44.8724, 20.0286) | 17.7232  | the scoop under the head                         |
| Blend       | (17.3065, 33.5945) | 13.0     | carries the throat onto the cut                  |
| Facing edge | —                  | straight | the upper side of the middle line                |

- **Head cusp** at (41.3675, 2.6554) — outer sweep into throat, 36°.
- **Tail cusp** at (18.0434, 59.8793) — the cut into the tail hook, 81°.
- **Tangent points** at (3.9761, 43.9116) outer sweep into tail hook, (29.0679, 28.0493) throat into
  blend, and (28.8667, 40.1963) blend onto the cut.

The outer sweep is centred at (r, r) for its own radius, so it is tangent to both the top and the
left edge of the stroke's bounding box. That relationship fell out of the fit rather than being
imposed, and it is the quickest way to check a redraw.

### The lower stroke

The outer silhouette is the upper stroke's, point-reflected and enlarged 7%:

```
translate(55.1029 100.3813) scale(-1.07)
```

A negative uniform scale is a 180° rotation and a 7% enlargement in one step. That gives:

| Segment     | Centre             | Radius   | Role                              |
| ----------- | ------------------ | -------- | --------------------------------- |
| Outer sweep | (23.8579, 69.1363) | 31.2450  | the outer edge                    |
| Tail hook   | (−0.1024, 83.1096) | 58.9820  | the hook into the tail            |
| Throat      | (7.0894, 78.9507)  | 18.9638  | the scoop under the head          |
| Blend       | (36.4044, 64.0737) | 13.9100  | carries the throat onto the cut   |
| Facing edge | —                  | straight | the lower side of the middle line |

- **Head cusp** at (10.8397, 97.5400) — outer sweep into throat, 36°.
- **Tail cusp** at (35.7966, 36.3105) — the cut into the tail hook, 81°.
- **Tangent points** at (50.8485, 53.3959) outer sweep into tail hook, (24.0003, 70.3687) throat
  into blend, and (24.2156, 57.3713) blend onto the cut.

Every one of those numbers is the point reflection of the upper stroke's, including the facing edge
and the blend, so the second stroke is written in the files as

```
<path d="…the upper stroke…" transform="translate(55.1029 100.3813) scale(-1.07)"/>
```

and the table above is a convenience, not a second source of truth. Keeping that exact — rather than
approximately — true is what fixes the cut's position; see **The middle line** above.

### The point

A circle of radius **10.4586** centred at **(60.4716, 17.3581)**.

Measured against the cut, its centre sits **43.95 units along** the cut from the cut's midpoint and
**14.90 units off** it, on the lower stroke's side. Its nearest approach to the S is 13.65 units —
a little over three times the width of the cut, which is what keeps it reading as a separate
particle rather than part of the letter.

An earlier draft of these files had it at (58.9234, 16.5279) with radius 10.2165. That was a
measurement error, not a decision: 1.8 units in and 2.3% small, which crowded the S's shoulder and
made the point look like a stray rather than a counterweight.

With the point included, the glyph spans 0 to 70.93 horizontally and 0 to 100.38 vertically.

### The tile

A square with a corner radius of **3/16 of its side** (18.75%). The glyph is scaled to **80% of the
tile height** and its ink bounding box — S and point together — is centred in the tile. At 512 px
that leaves 112 px clear on the left and right and 51 px top and bottom.

An earlier draft weighted the placement 46% of the way from the S's own centre toward the glyph's
right edge, on the theory that the light point should not drag the heavy S leftward. It
over-corrected badly: the mark sat 65 px from the left edge and 164 px from the right. Centring the
bounding box is both simpler and visibly right.

### Small sizes

At 32 px and below the 4.2-unit cut closes up. `psychsift-favicon.svg` is a separate optical cut for
that range: the gap is widened to **7.2 units** by moving each facing edge 1.5 units away from the
other, and the blends are re-solved against the lines they now meet. Because only the facing edges
move, the outer silhouette is identical to the one in the primary file. Use it for favicons, browser
tabs, and anything rendered under 32 px.

### The maskable icon

`psychsift-mark-maskable.svg` is full-bleed, because Android crops adaptive icons to whatever shape
the launcher uses. Everything that must survive that crop has to sit inside a centred circle of
**66.7% of the icon's width**. The glyph is scaled to **62% of the height**, which puts its furthest
ink 168 px from the centre of a 512 px icon against the 171 px the safe circle allows. Do not raise
that 62%: an earlier draft used 58% with a different centring and still put ink 176 px out, outside
the safe circle.

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
