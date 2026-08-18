# Caring contacts — accessibility and responsive acceptance

**Status:** local synthetic-prototype evidence, 15 August 2026  
**Boundary:** Chromium evidence and source review; not physical-device or production acceptance

## 1. Evidence classification

| Area                        | Status                                              | Evidence and limit                                                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320px / 400% reflow proxy   | Actual local Chromium evidence                      | 320px viewport is the repository proxy for 400% zoom on 1280px. Core, boundary and delivery journeys have no horizontal page overflow or obscured action. This is a proxy, not a browser-zoom measurement.                                                  |
| 390px                       | Actual local Chromium evidence                      | Compact shell, four-item dock, activation sheets, all overlays, offline/protected actions and final screenshots.                                                                                                                                            |
| 430px                       | Actual local Chromium evidence                      | Compact continuity retained at the upper compact boundary; no horizontal overflow.                                                                                                                                                                          |
| 768px                       | Actual local Chromium evidence                      | Collapsed desktop navigation/rail state, not enlarged phone; contextual delivery rail remains in bounds.                                                                                                                                                    |
| 1024px                      | Actual local Chromium evidence                      | Split-capable continuity; no clipped panes or horizontal page overflow.                                                                                                                                                                                     |
| 1440px                      | Actual local Chromium evidence                      | Wide navigation, workflow preview, dialogs/drawers and final screenshots.                                                                                                                                                                                   |
| Keyboard and focus          | Actual DOM and Chromium evidence                    | Keyboard activation, workflow-heading focus, Escape dismissal, trigger focus restoration, session-gate containment, offline focusability and protected-decision denial.                                                                                     |
| Names, roles and states     | Actual DOM and Chromium evidence plus source review | One page `h1`; named navigation, lists, dialogs, status banner, schedule and controls; expanded/current/unavailable states exposed.                                                                                                                         |
| Word/non-colour status      | Actual DOM/source evidence                          | Every operational status has visible text and a dot/icon/structure. Tests retain wording in forced colours.                                                                                                                                                 |
| Text sizing and long values | Source plus responsive rendered evidence            | Semantic type tokens; full values wrap; no truncated page/dialog title; 320px overflow proof. Dedicated browser text-resize beyond the 320px proxy is unrun.                                                                                                |
| Dock and safe area          | Actual local Chromium evidence                      | Compact actions are scrolled clear of the fixed dock in routine journeys. During evidence capture only, the fixed phone dock is hidden and each required region is asserted not to intersect a painted/interactive fixed overlay before pixels are written. |
| Dark mode                   | Rendered specimen plus source review                | Dark specimen uses repository theme roles. A whole-suite dark-theme screenshot journey is not part of this focused proof.                                                                                                                                   |
| Forced colours              | Actual local Chromium media evidence                | Forced-colour media activates; status words remain; system-colour continuity and specimens are present.                                                                                                                                                     |
| Reduced motion              | Actual local Chromium media evidence                | Reduced-motion media activates; continuity and status meaning remain; motion classes stop/avoid animation.                                                                                                                                                  |
| Physical iPhone Safari      | **Unrun — required later**                          | Chromium responsive emulation cannot close Safari viewport, safe-area, keyboard or focus behaviour.                                                                                                                                                         |
| Installed PWA               | **Unrun — required later**                          | Requires an authorised production-like build on a managed physical device, including install/launch and offline boundary checks.                                                                                                                            |

## 2. Final rendered-evidence manifest

The ignored local directory
`.local/caring-contact-design-evidence/2026-08-15` contains exactly the following 26 synthetic PNGs.
Routine browser runs do not write or remove evidence; only
`CARING_CONTACT_CAPTURE_EVIDENCE=1` enables the deterministic reset and capture. Delivery and
component/state dialogs use named internal-scroll slices so the real viewport, header/footer and
every required section are represented without expanding the production Sheet.

| File                                                    | Dimensions |
| ------------------------------------------------------- | ---------- |
| `foundation-phone-390.png`                              | 390×1410   |
| `foundation-desktop-1440.png`                           | 1440×698   |
| `today-phone-390.png`                                   | 390×1142   |
| `today-desktop-1440.png`                                | 1440×606   |
| `activation-review-phone-390.png`                       | 390×2777   |
| `activation-review-desktop-1440.png`                    | 1440×2401  |
| `patient-overview-phone-390.png`                        | 390×2626   |
| `patient-overview-desktop-1440.png`                     | 1440×2193  |
| `schedule-phone-390.png`                                | 390×2644   |
| `schedule-desktop-1440.png`                             | 1440×2202  |
| `delivery-exception-transport-phone-390.png`            | 390×844    |
| `delivery-exception-transport-desktop-1440.png`         | 512×1000   |
| `delivery-exception-operational-task-phone-390.png`     | 390×844    |
| `delivery-exception-operational-task-desktop-1440.png`  | 512×1000   |
| `delivery-exception-clinical-boundary-phone-390.png`    | 390×844    |
| `delivery-exception-clinical-boundary-desktop-1440.png` | 512×1000   |
| `delivery-exception-audit-phone-390.png`                | 390×844    |
| `delivery-exception-audit-desktop-1440.png`             | 512×1000   |
| `component-state-interaction-phone-390.png`             | 390×844    |
| `component-state-interaction-desktop-1440.png`          | 1392×952   |
| `component-state-content-phone-390.png`                 | 390×844    |
| `component-state-content-desktop-1440.png`              | 1392×952   |
| `component-state-modes-phone-390.png`                   | 390×844    |
| `component-state-modes-desktop-1440.png`                | 1392×952   |
| `component-state-system-phone-390.png`                  | 390×844    |
| `component-state-system-desktop-1440.png`               | 1392×952   |

Every file was visually inspected after the final capture. The phone dock is absent from capture
pixels; required content remains visible across the named slices; the desktop Version conflict tile
is fully visible in `component-state-system-desktop-1440.png`.

## 3. Keyboard and focus acceptance

- Destination buttons, More sheet, workflow stages and every enabled decision are keyboard
  reachable and have an object-specific accessible name.
- Moving between activation stages focuses the new stage heading and announces the stage.
- Escape closes dismissible sheets/dialogs and returns focus to the invoking control.
- The session-expiry gate uses the shared Sheet stack, keeps the background inert, locks body scroll,
  traps focus and resists Escape/backdrop dismissal until `Sign in again`.
- Persistent offline status is non-modal; focus can leave it. Mutation controls remain focusable with
  `aria-disabled`, a visible reason and no state change. Read-only inspection remains available.
- Phone full-screen protected stages and desktop dialogs retain a visible decision, close path where
  permitted and unobscured validation/action region.

## 4. Responsive continuity

The frozen shell mapping is 320–430 compact, 768 rail, 1024 split-or-safe-fallback and 1440 wide.
The same information and action sequence is retained; content is not removed to make a width pass.
Today remains action-first, patient identity stays in the activation flow, Schedule retains its
seven-day strip and day detail, and the continuity ordered list remains the semantic source of truth.

At compact widths the four-item dock owns the bottom edge. In-flow screens retain enough final
clearance; full-screen Sheets own their safe-area action region. At desktop widths the delivery
exception is a constrained right contextual rail and confirmation decisions remain bounded.

## 5. Known acceptance gaps

Before production, run real 400% browser zoom with text-only enlargement, Windows High Contrast with
representative assistive technology, VoiceOver on physical iPhone Safari, keyboard appearance and
rotation, and installed-PWA launch/offline/focus journeys. Those checks must use an approved
production implementation and synthetic or authorised test data. The current prototype evidence
does not establish WCAG conformance, clinical accessibility approval or device support.
