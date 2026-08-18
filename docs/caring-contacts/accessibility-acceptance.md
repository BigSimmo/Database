# Caring Contact accessibility acceptance

## Navigation and focus

- Every major surface has a real Next.js destination and an inbound link.
- Page navigation moves natural focus to the level-one heading and announces the destination.
- Overlay state is represented in the URL, supports browser history and restores focus to the originating control on close.
- Session expiry remains modal and action-only; offline status remains non-modal and does not trap focus.
- Dialog and sheet background content is inert and background scrolling is blocked through the shared `Sheet` contract.

## Controls and feedback

- All visible actions navigate, submit, open a contextual surface or expose a named unavailable reason.
- Persistently unavailable actions remain focusable with `aria-disabled` and an associated reason.
- Transiently busy controls may use native `disabled` only while an operation is in progress.
- Mutation success, guard rejection, no-change outcomes and recovery are announced through the shared live announcer.
- Protected irreversible decisions provide explicit confirmation language and a visible fresh-auth checkpoint.

## Responsive and zoom

- Required review widths: 320, 390, 430, 768, 1024, 1440 and 1920 CSS pixels.
- Phone content remains below the effective top safe area and scrolls clear of the bottom dock.
- Controls provide at least a 44 by 44 CSS-pixel target in compact layouts.
- Data tables become labelled record cards where a table would force horizontal page scrolling.
- At 400% zoom on a 1280-pixel viewport, the page reflows to a compact composition without horizontal document scrolling.
- Long names, service labels and larger text wrap without clipping or hiding their associated status.

## Perception and motion

- Status is communicated through text/icon/structure, never colour alone.
- Clinical Sky marks navigation and selection; Graphite marks decisive commands; green, amber and red retain verified, attention and critical semantic roles.
- Dark roles use repository tokens rather than inverted hard-coded colours.
- Forced-colour mode retains visible borders, selected states and focus indicators.
- Reduced-motion mode removes non-essential movement without removing state feedback.

## Browser evidence boundary

Focused Chromium evidence covers keyboard, focus, responsive geometry, dark, forced-colour, reduced-motion and zoom-reflow contracts. It does not constitute physical iPhone Safari or installed-PWA acceptance; those remain separate device checks.
