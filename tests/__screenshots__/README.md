# Visual baselines

Golden screenshots for `tests/ui-visual-baseline.spec.ts`, compared by the
`Visual baselines` CI job. These files are tracked deliberately — see the note in
`.gitignore`, which excludes only the regenerated `/lighthouse/` reports.

## The layout is platform-scoped, and that matters

`playwright.visual.config.ts` sets:

```
snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}"
```

`{platform}` is the `process.platform` of whichever machine took the shot, so a
baseline recorded on Windows lands in `win32/` and is never consulted by CI, which
runs `ubuntu-24.04` and looks in `linux/`. **Only `linux/` baselines gate anything.**
Committing `win32/` images does not protect the build; it silently adds files CI
ignores.

Font rasterisation, scrollbar metrics, and form-control rendering all differ between
platforms, so this is a real constraint rather than a path-naming detail — the same
page genuinely does not produce identical pixels on Windows and Linux.

## Seeding or refreshing the `linux/` baselines

The CI job is the supported recorder. It runs `npm run test:e2e:visual` and uploads
`test-results/` plus `tests/__screenshots__/` as the `visual-baseline-<run_id>`
artifact. On a first run, targets listed in `AWAITING_BASELINE` are skipped after
writing candidate PNGs under `test-results/visual-candidates/linux/`. The suite does
not write directly into the tracked snapshot directory: doing so could let a retry
adopt its own output and report a false green.

1. Push a branch whose diff sets `ui_changed=true` (any `tests/ui-*.spec.ts`,
   `playwright*.config.ts`, `src/`, or a path under `tests/__screenshots__/` — the
   trigger list lives in `scripts/ci-change-scope.mjs`).
2. Download the `visual-baseline-<run_id>` artifact from that run.
3. Copy the reviewed PNGs from `test-results/visual-candidates/linux/` into
   `tests/__screenshots__/linux/`.
4. Remove those target names from `AWAITING_BASELINE` in
   `tests/ui-visual-baseline.spec.ts` in the same commit. The
   `declares no baseline it already has` test fails if a committed golden remains
   exempted.
5. Re-run. The job now compares against the committed PNGs.

Locally, `npm run test:e2e:visual:update` refreshes baselines for **your** platform
only. That is useful for iterating on the spec; it cannot produce the `linux/`
baselines CI needs. A Linux container running the repo's own Playwright image can.

## Before trusting a baseline

A screenshot is only evidence if it was stable when recorded. Record, then re-run
without `--update-snapshots`: a baseline that fails its own immediate re-run is
capturing a race, not a design. `maxDiffPixelRatio: 0.002` with `threshold: 0.2`
absorbs antialiasing, not layout that has not settled.

Comparison is advisory. Pixel drift produces a workflow warning and summary while
the job uploads expected, actual, and diff images for review; it does not produce a
failed GitHub check. Missing baselines and other non-comparison failures stay red.
The job runs post-land, weekly, or manually rather than on pull requests and merge
queues. Setup or artifact-upload failures can still fail the job because they leave
no trustworthy evidence to review.

## Human adoption checklist (Linux goldens)

The six canonical Linux PNGs are **already tracked** in `tests/__screenshots__/linux/`:

- `dashboard-shell.png`
- `dashboard-shell-phone.png`
- `search-results-band.png`
- `search-results-band-phone.png`
- `document-viewer.png`
- `therapy-compass-home.png`

Do **not** list those ids in `AWAITING_BASELINE` while the files exist. `declares no baseline it already has` fails if a committed golden remains exempted. Keep `AWAITING_BASELINE` empty unless a golden is actually deleted (or a new target is added with no PNG yet).

Tracked pixels are not human adoption. Adoption stays `not-committed` / `files: []` / provenance pending until a human reviews a hosted **ubuntu-24.04** artifact:

1. Download the `visual-baseline-<run_id>` artifact from that hosted run.
2. Human review (BigSimmo): the candidate PNGs under `test-results/visual-candidates/linux/` are the design, not a race.
3. If replacing goldens, copy the reviewed files into `tests/__screenshots__/linux/` in the same commit as provenance / `reviewed-by-login`.
4. Keep `AWAITING_BASELINE` empty unless a golden is actually deleted.

Local Windows captures are not Linux goldens. `win32/` images do not gate CI.
