---
name: ui
description: Inspect and verify the live Database interface across routes, breakpoints, interactions, accessibility modes, reduced motion, and forced colors. Use for UI, frontend, routing, styling, responsive, browser, or accessibility work.
---

# UI

1. Read the relevant Next.js guide under `node_modules/next/dist/docs/` before code changes.
2. Run `npm run workflow:design-sweep -- --write-evidence` and then `npm run ensure`.
3. Verify project identity before browser work; do not assume a port.
4. Inspect affected routes at phone and desktop widths plus keyboard, focus, reduced-motion, and forced-colors states.
5. Add the smallest focused browser proof, then use `npm run verify:ui` when proportionate.
6. Report routes, viewports, interactions, accessibility evidence, and residual visual risk.
