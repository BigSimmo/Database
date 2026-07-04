# Project Mockups

This folder collects notes for mockup routes that live under `src/app/mockups/`.

## Authoritative route list

The generated route map in [`docs/site-map.md`](../docs/site-map.md) (mockups section) is the source of truth for runnable mockup URLs. Regenerate it after adding or removing mockup routes:

```bash
npm run sitemap:update
npm run sitemap:check
```

## Design tokens

Mockups use the Clinical White / Aegean Graphite role tokens (`--command`, `--clinical-accent`, `--success`) from [`docs/redesign/02-design-direction.md`](../docs/redesign/02-design-direction.md). Older design-exploration mockups were removed in July 2026 so stale palettes do not mislead future design review.

## Global search shell

Runnable mockups under `src/app/mockups/*` inherit the shared Clinical KB header and bottom search composer from `src/app/mockups/layout.tsx`.

- Put the mockup content between the global header and bottom composer; do not copy the header or composer into new pages.
- Tool and favourites mockups keep the shared app header but hide the bottom composer because they provide their own primary search surface.
- Use `?mode=answer`, `?mode=documents`, `?mode=prescribing`, `?mode=evidence`, or `?mode=favourites` to preview the active search mode.
- The bottom composer routes live searches to the dashboard with `mode`, `q`, and `run=1`; New chat routes to `/?mode=answer&focus=1`.
- If a future mockup must be standalone, move it outside the `/mockups` route shell or add an explicit opt-out route group before implementing it.

## Production behavior

- `/mockups/*` prototype routes are development-only; production returns 404 and `robots.txt` disallows indexing.
- `/mockups/favourites-hub` is a legacy compatibility route and redirects to `/favourites`.
- `/mockups/medication-prescribing` redirects to `/medications/acamprosate`; prescribing mode also lives at `/?mode=prescribing`.

## Synthetic document-search assets

The document-search mockups use generated non-patient bitmap assets in `public/mockups/document-search/`. These images are abstract UI/document textures only: they must not be treated as source screenshots, hospital-branded material, or clinical content.

Some document-search mockups include live handoff routes (for example `document-search/source-overlays`) that resolve into the real document viewer with a selected page and chunk when indexed data is available locally.
