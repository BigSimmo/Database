# Physical iPhone phone-chrome acceptance

Run this labelled checklist after `npm run verify:phone-chrome` passes and before merging a change that affects shared phone chrome, viewport ownership, safe areas, composer reserves, or hide/reveal motion. Chromium geometry is necessary but cannot prove pixels owned by iOS WebKit.

## Build and evidence label

Record one label for the complete pass:

- PR / branch:
- commit SHA:
- staging URL and deployment ID:
- iPhone model:
- iOS version:
- tester and timestamp:

Use the same commit for Safari and the cold-launched Home Screen app. Do not accept a warm PWA that may still be running an older service worker or cached bundle.

## Matrix

Complete every row in both light and dark theme. Portrait is required for every row; repeat the visible/hidden rows in landscape. Mark `pass`, `fail`, or `not applicable` and attach the matching screenshot/video label.

| Surface                                                 | Container       | Keyboard            | Scroll direction / state              | Required result                                                                                            | Result / evidence |
| ------------------------------------------------------- | --------------- | ------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------- |
| Submitted Services or Forms results                     | Safari tab      | closed              | top, chrome visible                   | One header owner and one footer owner; app content paints continuously around Safari's native controls     |                   |
| Submitted Services or Forms results                     | Safari tab      | closed              | deliberate down, chrome hidden        | Header and footer fully release together; no app-owned top or bottom band; no content jump or oscillation  |                   |
| Submitted Services or Forms results                     | Safari tab      | closed              | deliberate up, chrome revealed        | Both edges return smoothly and remain tappable                                                             |                   |
| Submitted Services or Forms results                     | Safari tab      | open then dismissed | down and up                           | Focus pins visible chrome while the keyboard is open; dismissal restores hide/reveal without stale reserve |                   |
| Answer result                                           | Safari tab      | closed              | visible, hidden, revealed             | Overlay header and answer dock remain symmetric; content position changes monotonically                    |                   |
| Document detail                                         | Safari tab      | closed              | visible, hidden, revealed             | Universal header and document-owned composer follow the document scroll owner together                     |                   |
| Page-owned footer (calculator or differential workflow) | Safari tab      | closed              | visible and hidden where supported    | Footer reaches its intended physical edge and releases only its own reserve                                |                   |
| Submitted Services or Forms results                     | cold-launch PWA | closed              | top, chrome visible                   | Inner main scroller owns movement; footer is frame-owned and reaches the PWA edge                          |                   |
| Submitted Services or Forms results                     | cold-launch PWA | closed              | down, hidden; up, revealed            | Same symmetric, jump-free behaviour as Safari; no retained safe-area strip                                 |                   |
| Document detail                                         | cold-launch PWA | closed              | visible, hidden, revealed             | Page-owned footer stays outside the inner scroller and anchored to the 100vh frame                         |                   |
| Any bottom composer                                     | cold-launch PWA | open then dismissed | rotate portrait to landscape and back | Keyboard and orientation changes do not leave a stale reserve, duplicate owner, or unreachable control     |                   |

## Pass criteria

- The app owns exactly one top-chrome surface and at most one footer/composer surface.
- `data-phone-scroll-owner`, `data-phone-footer-owner`, `data-phone-composer-reserve`, and `data-phone-chrome-transition` agree with the visible layout when inspected through Safari Web Inspector.
- Hidden chrome has zero app-owned reserve at that edge. Native Safari status/address controls may remain visible; pixels outside the reported web viewport are system-owned.
- No contrasting app-owned band surrounds Safari's native controls. Match the root canvas colour; do not use negative safe-area overscan, fixed-root tricks, or synthetic padding to imitate ownership of system pixels.
- Hide and reveal are monotonic, smooth, and symmetric. There is no geometry jump, bottom clamp loop, flash of a duplicate composer, or scroll position reset.
- Light/dark, portrait/landscape, keyboard open/closed, down/up scroll, and visible/hidden states all pass for both Safari and a cold-launch PWA.

If any row fails, retain the commit label and evidence, add the exact route/state to the focused Playwright coverage where emulation is meaningful, and rerun the entire affected container column after the fix.
