# PsychSift design handover

A single self-contained briefing for a designer, agency, or design tool picking up the PsychSift
mark. Everything here is the artwork itself, not a description of it — the numbers are the exported
values from `src/lib/brand-mark.ts`, which is the single source of truth every surface derives from.

For _why_ the mark is built the way it is — the provenance, the three drafts that got it wrong, the
settled decisions — read [`psychsift-logo.md`](psychsift-logo.md). This page is the spec you hand
outward; that page is the record you keep.

## What it is

PsychSift is a clinical reference tool for psychiatrists. You ask a clinical question and it answers
with citations that link straight back to the original guideline PDF. Strapline: **From question to
source.** Australian English throughout. Tone: precise, calm, unshowy — a reference instrument, not
a consumer app.

The mark is an **S**, cut once: two counter-turning strokes divided by a straight gap of constant
width, with a settled point cradled in the throat. It reads as the sift, and as the thing that
settles out of it.

## Links

| What                                                                                  | Where                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Design canvas — six artboards: mark, construction, sizes, colour, lockups, typography | https://claude.ai/artifact/S2F3SYG5NrKFBHB7fhxYgP                    |
| Brand sheet — the same specification written out long-form                            | https://claude.ai/code/artifact/6da77bde-05a7-4b77-ae8e-e96d0c9b1dc6 |
| Live asset index, public, no login                                                    | https://psychiatry.tools/brand/preview.html                          |
| Production app                                                                        | https://psychiatry.tools                                             |

Both Claude artifacts are **private to the owner**. Anyone else needs to be given access from the
page's own Share menu before the link will open for them.

The canvas is regenerated from [`canvas/`](canvas/README.md) in this repository, so it can be
rebuilt if the published copy is ever lost.

## Master artwork — public URLs

Served from `public/brand/`, so each file's public address is its path under `/brand/`.

| File                                      | What it is                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `psychsift-mark.svg`                      | Fixed navy master (hardcoded `#0D1B2A` tile + white glyph — not theme-aware; theme-aware consumers use generated `app/icon.svg`) |
| `psychsift-mark-blue.svg`                 | The mark, flat brand blue                                                                                                        |
| `psychsift-mark-light.svg`                | The mark for dark grounds                                                                                                        |
| `psychsift-glyph-navy.svg`                | Bare symbol, no tile — navy                                                                                                      |
| `psychsift-glyph-white.svg`               | Bare symbol, no tile — white                                                                                                     |
| `psychsift-glyph-mono.svg`                | Bare symbol, single colour                                                                                                       |
| `psychsift-wordmark.svg`                  | Wordmark alone                                                                                                                   |
| `psychsift-lockup-horizontal.svg`         | Mark + name, horizontal                                                                                                          |
| `psychsift-lockup-horizontal-tagline.svg` | Horizontal with tagline — **stale, see Open items**                                                                              |
| `psychsift-lockup-horizontal-reverse.svg` | Horizontal for dark grounds                                                                                                      |
| `psychsift-lockup-stacked.svg`            | Mark above name                                                                                                                  |
| `psychsift-favicon.svg`                   | Small-size cut, browser tab                                                                                                      |
| `psychsift-mark-maskable.svg`             | Android maskable icon                                                                                                            |
| `psychsift-mark-1024.png`                 | Raster, 1024 px                                                                                                                  |
| `psychsift-mark-maskable-1024.png`        | Raster maskable, 1024 px                                                                                                         |

## The geometry — authoritative, do not redraw by hand

Every curve is a circular arc. Coordinate space is a 100 × 100 glyph drawn into a 512 × 512 master.

**Upper stroke** — four arcs and one straight cut, meeting at two cusps:

```
M41.3675 2.6554 A17.7232 17.7232 0 0 0 29.0679 28.0493 A13 13 0 0 1 28.8667 40.1963
L18.0434 59.8793 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z
```

**Lower stroke** is not a second drawing. It is the same path under:

```
transform="translate(55.1029 100.3813) scale(-1.07)"
```

a 180° turn about (26.6198, 48.4934) with a 7% enlargement. That is what carries the upper stroke's
facing edge exactly onto the lower one and keeps the cut parallel.

**The point:** `<circle cx="44.8724" cy="20.0286" r="10.4586" />`

Its centre is exactly the centre of the throat arc, so the white crescent between the point and the
curve that cups it is a constant **7.2646** all the way round. Move it off that centre and the
crescent tapers. This is the single most important constraint in the mark.

### Arc centres

| Arc          | Radius  | Centre                                         |
| ------------ | ------- | ---------------------------------------------- |
| Outer ring   | 29.2009 | (29.2009, 29.2009) — tangent to both axes      |
| Throat       | 17.7232 | (44.8724, 20.0286)                             |
| Transition   | 13.0000 | (17.4753, 33.9324)                             |
| Inner sweep  | 55.1234 | (51.5936, 16.1417)                             |
| Straight cut | —       | 22.4625 long, 4.2000 wide, both edges parallel |

### Placement into the 512 master

| Use                                             | Transform                                |
| ----------------------------------------------- | ---------------------------------------- |
| On a tile — glyph at 80% of tile height         | `translate(143.1125 51.2) scale(4.0804)` |
| Bare, no tile — ink fills the box top to bottom | `translate(114.8907 0) scale(5.1006)`    |
| Small-size set, on a tile                       | `translate(122.7103 51.2) scale(4.0804)` |
| Small-size set, bare                            | `translate(89.3877 0) scale(5.1006)`     |

Tile: 512 × 512, corner radius 96 — 3/16 of the side. Maskable safe circle: r 170.8 at (256, 256),
which is 66.7% of the icon width; the maskable glyph is scaled to 62% of the height, putting its
furthest ink 159 px out against the 171 px allowed. Do not raise that 62%.

## The small-size set — three changes that only ever travel together

At 32 px and below the 4.2-unit gap closes up and the point fuses into the S. There is a second cut of the
same silhouette for that range (matching `chrome` in `src/lib/brand-mark.ts` and `docs/brand/psychsift-logo.md`). Never mix one variant's cut with the other's point placement or
centring — the glyph goes off-centre in the tile.

```
M41.3675 2.6554 A17.7232 17.7232 0 0 0 28.6276 27.115 A13 13 0 0 1 28.1033 38.5768
L16.8897 58.9696 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z
```

- Cut opens from 4.2000 to 7.2000, by moving each facing edge 1.5 units away from the other. Only
  the facing edges move, so the outer silhouette is identical to the primary file's.
- Point slides 10 units out of the cradle to `cx="54.8724"`, opening the crescent to 11.55.
- Its own centring, because the ink box is 10 units wider: `translate(122.7103 51.2) scale(4.0804)`.

Below about 20 px the crescent is under two pixels and the point fuses into the S whatever is done.
That is the size, not the placement.

## Colour

These are the **effective in-app tokens** under `.ckb-v2` (source of truth:
`src/app/ckb-v2-tokens.css`). Accent and accent-strong still resolve from the compatibility layer
in `globals.css`; the surface, text, and soft-accent swatches below are the v2 overrides a designer
will actually see. The standalone artwork in `public/brand/` still carries an older palette — see
Open items.

**Light**

| Hex       | Token                      | Use                         |
| --------- | -------------------------- | --------------------------- |
| `#1D6FB8` | `--clinical-accent`        | The mark, links, focus      |
| `#185C99` | `--clinical-accent-strong` | Pressed and hover           |
| `#F2F8FE` | `--clinical-accent-soft`   | Quiet accent grounds        |
| `#FCFDFE` | `--surface-raised`         | Page ground behind the mark |
| `#0A1220` | `--text-heading`           | Wordmark                    |
| `#55627A` | `--text-muted`             | Strapline                   |

**Dark**

| Hex       | Token                      | Use                         |
| --------- | -------------------------- | --------------------------- |
| `#74BDF0` | `--clinical-accent`        | The mark, links, focus      |
| `#A9D8F8` | `--clinical-accent-strong` | Pressed and hover           |
| `#123556` | `--clinical-accent-soft`   | Quiet accent grounds        |
| `#1C2126` | `--surface-raised`         | Page ground behind the mark |
| `#FBFCFD` | `--text-heading`           | Wordmark                    |
| `#A8B2BD` | `--text-muted`             | Strapline                   |

The mark carries the colour and the ground stays out of its way. Ink is always the accent token; the
tile is always the page ground. That is why on white the mark reads as the bare symbol with no box
around it — the tile exists only because a `.ico` and a raster app icon have no transparency and
must paint something.

`BRAND_LIGHT` and `BRAND_DARK` in `src/lib/brand-mark.ts` cannot read the CSS tokens, because the
favicon and the generated icon routes render outside any stylesheet. A design-token contract test
fails if the two ever disagree, so the accent can only move in both places at once.

## Typography

The in-app lockup uses the app's own type ramp, so header and interface stay in sync by
construction. There is no separate brand ramp.

- **Wordmark** — 18 px, weight 800, tracking −0.02 em (`--tracking-display`), `--text-heading`
- **Strapline** — 12 px, weight 500, tracking 0 (`--tracking-normal`), `--text-muted`
- Family — Geist Sans, then the system stack
- Set in sentence case, no full stop, never all caps

The tracking ladder is exactly five values and no others:

| Token                | Value   | Used for                 |
| -------------------- | ------- | ------------------------ |
| `--tracking-display` | −0.02em | Display and the wordmark |
| `--tracking-normal`  | 0       | Body and the strapline   |
| `--tracking-label`   | 0.06em  | Uppercase labels         |
| `--tracking-eyebrow` | 0.08em  | Eyebrows                 |
| `--tracking-kicker`  | 0.12em  | Kickers                  |

Two constraints that came out of measurement, not taste:

1. The strapline stays `--text-muted`. The next grey down the ramp measures 3.07:1 on white, which
   fails contrast.
2. It stays sentence case at 12 px. Pushed to a tracked uppercase label it stops reading as a
   sentence and starts reading as a section heading.

The wordmark inside the standalone SVG lockups is **outlined Inter Display SemiBold**, not Geist.
As artwork that is unaffected by what the application loads, but a wordmark set live in Geist will
not match it.

## Rules

- Clear space on every side is at least **a quarter of the mark's height** — of type, of image
  edges, of other marks.
- The symbol is the primary asset and stands alone wherever the name is already present.
- Where the name is needed, the mark leads and the strapline sits under it — never beside it.
- Do not re-draw the arcs, re-space the cut, or move the point off the throat centre.
- Do not outline the mark, add a shadow or gradient, rotate it, stretch it non-uniformly, or set it
  in any colour outside the accent pair.
- Do not re-trace a PNG export. Start from the SVG.
- Production tap targets are 48 px (`min-h-12`), deliberately above the 44 px guideline — 44 px
  reintroduced a known rendering flake. Do not "correct" this downward.

## Where it lives in the codebase

| Path                                                         | What it is                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/lib/brand-mark.ts`                                      | **Single source of truth.** Every path, transform, radius and colour above is exported from here. |
| `src/components/clinical-dashboard/brand.tsx`                | The in-app React mark                                                                             |
| `src/components/clinical-dashboard/master-search-header.tsx` | The header lockup — wordmark and strapline as built                                               |
| `scripts/generate-brand-assets.ts`                           | Regenerates `src/app/icon.svg` from the source of truth                                           |
| `src/app/icon.svg`                                           | Browser-tab icon — generated, never hand-edited                                                   |
| `public/brand/`                                              | All the downloadable assets listed above                                                          |
| `docs/brand/psychsift-logo.md`                               | The written construction record                                                                   |
| `docs/brand/preview.html`                                    | The asset index, mirrored byte-for-byte to `public/brand/preview.html`                            |
| `docs/brand/canvas/`                                         | The design canvas generator                                                                       |
| `src/app/globals.css`                                        | Design tokens — the colour and tracking values above live here                                    |
| `docs/design-system/README.md`                               | The design system's own system of record                                                          |

Two guardrails already fail a build on drift: `npm run brand:check` verifies the generated icon
still matches the source of truth, and the design-token contract test fails if the brand colours
ever disagree with the CSS tokens.

## Open items

1. **Two palettes.** The in-app mark is `#1D6FB8` / `#74BDF0` on the page ground. The standalone
   artwork in `public/brand/` is still the brand-sheet palette — navy `#0D1B2A`, white, `#2563EB`,
   cool grey `#F2F4F7`. Both are in use and they have not been reconciled.
2. **Two wordmark faces.** The SVG lockups carry outlined Inter Display SemiBold; the application
   sets its wordmark live in Geist.
3. **`psychsift-lockup-horizontal-tagline.svg` is stale.** It still carries the retired line
   "CLARITY. EVIDENCE. BETTER CARE." rather than "From question to source".
4. **No print specification.** No CMYK or Pantone equivalents, no minimum print size, no one-colour
   reproduction guidance.
5. **No motion specification.**
