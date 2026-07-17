---
name: live-design-sweep
description: Inspect and improve the running Database application across routes, responsive breakpoints, keyboard interaction, accessibility modes, and shared UI surfaces. Use for design reviews, UI polish, browser QA, screenshots, mobile checks, accessibility work, or requests to find and fix visual or interaction defects across the app.
---

# Live Design Sweep

1. Run `npm run workflow:design-sweep` to print the proof contract.
2. Run `npm run ensure` before opening the app. Use only the identity-verified URL it prints.
3. Derive route coverage from `docs/site-map.md` and changed navigation. Inspect representative content-rich, empty, loading, error, dialog, and long-scroll states.
4. Cover 320, 390, 639, 768, 1440, and 1920 px where applicable. Check horizontal overflow, single-scrollport ownership, sticky/fixed collisions, tap targets, wrapping, and safe-area behavior.
5. Check keyboard order, visible focus, dialog focus trapping and restoration, accessible names, contrast, reduced motion, forced colors, zoom, and screen-reader semantics.
6. Record reproducible defects with route, viewport, trigger, expected behavior, and screenshot or test evidence. Fix shared primitives before duplicating route-specific patches.
7. Add the smallest regression proof, then run focused Playwright, accessibility, `verify:ui`, and `verify:cheap` in that order as warranted.
8. Write durable route/breakpoint coverage to the task report or `docs/archive/design-qa.md` when the pass is broad.

Do not claim external design fidelity unless a target design or screenshot was supplied.
