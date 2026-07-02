# Crisp white colour system plan

## Goal

Replace the warm cream/porcelain light-mode direction with a cleaner, whiter, more polished clinical interface. The target is a premium white workspace: crisp like ChatGPT/Apple-style product surfaces, but still clinical, source-backed, and operational rather than decorative.

The product is Clinical Guide: a source-backed clinical knowledge workspace for repeated question answering, document search, medication guidance, and safety review. The design job is to make the user trust the answer surface, understand source status quickly, and feel that the app is modern and precise.

## Current design findings

### Medium: the current light foundation still reads warm rather than crisp

Evidence:

- `src/app/globals.css:68` describes light mode as "porcelain workspace".
- `src/app/globals.css:94` sets `--background: #f7f7f4`.
- `src/app/globals.css:99-105` uses off-white raised/subtle/inset surfaces.

Why it matters:

- The user's newer direction is explicitly crisp white, not cream.
- A warm base can look softer and more editorial, but this app needs to feel precise, clean, and instrument-grade.

Recommended fix:

- Move the light canvas to true white.
- Use cool neutral rails and panels only where hierarchy is needed.
- Let depth come from hairline borders, low-alpha graphite shadows, and spacing, not a tinted page background.

Verification:

- A full-page light screenshot should read white first, not ivory or mint.

### Medium: teal is still doing too much visual work

Evidence:

- `src/app/globals.css:113-122` maps primary and clinical chat aliases to teal.
- `src/components/clinical-dashboard/ClinicalSidebar.tsx:136` uses teal for the primary sidebar CTA.
- `src/components/clinical-dashboard/master-search-header.tsx:719-725` uses teal in the main answer-mode control.

Why it matters:

- Teal should communicate clinical evidence, source state, selected mode, and send intent.
- If the primary CTA, selected tile, source chip, icon tile, and composer all glow teal, the UI reads themed instead of premium.

Recommended fix:

- Use graphite for the strongest normal action.
- Use teal as an instrument accent: selected state rail, source confidence, send, and evidence-backed marks.
- Keep amber/red reserved for safety and setup, never for decoration.

Verification:

- In light mode, the dominant colours should be white, graphite, and cool neutral. Teal should appear as a deliberate signal.

### Low: existing component hooks are good enough for a token-led implementation

Evidence:

- `src/app/globals.css:40-64` already exposes semantic Tailwind colour bridge tokens.
- `src/components/clinical-dashboard/master-search-header.tsx:800-884` centralises header actions and the answer footer composer shell.
- `src/components/clinical-dashboard/ClinicalSidebar.tsx:330` and `src/components/clinical-dashboard/ClinicalSidebar.tsx:422` centralise sidebar rails.

Why it matters:

- This should not need a component rewrite.
- The safest implementation path is token replacement plus a few targeted material overrides.

Recommended fix:

- Apply the new colour system first in `:root`.
- Then tune the sidebar, header, composer, empty state, answer cards, and source chips through existing class hooks.

Verification:

- The app should visually change without changing answer generation, routing, or data contracts.

## Proposed design direction: Clinical White

Clinical White is a clean white workspace with graphite command weight, nickel borders, and restrained clinical teal. It removes the cream page base and avoids broad mint washes.

### Core tokens

| Role             | Token         | Hex       | Use                                                         |
| ---------------- | ------------- | --------- | ----------------------------------------------------------- |
| Canvas           | `white-0`     | `#FFFFFF` | Main app background                                         |
| Rail             | `white-rail`  | `#F7F8FA` | Sidebar/header bands, subtle separated regions              |
| Paper            | `paper`       | `#FFFFFF` | Cards, popovers, answer surfaces                            |
| Raised           | `raised`      | `#FCFCFD` | Floating controls and composer                              |
| Inset            | `inset`       | `#F1F3F5` | Search fields, subtle chip backgrounds                      |
| Border           | `line`        | `#E5E7EB` | Default hairline                                            |
| Strong border    | `line-strong` | `#D0D5DD` | Focused/selected outer lines                                |
| Ink              | `ink`         | `#101418` | Primary text                                                |
| Graphite         | `graphite`    | `#111827` | Primary CTA, high-emphasis controls                         |
| Muted text       | `muted`       | `#475467` | Secondary text                                              |
| Soft text        | `soft`        | `#667085` | Metadata, placeholders                                      |
| Clinical teal    | `teal`        | `#0B7A75` | Evidence, selected rail, send                               |
| Soft teal        | `teal-soft`   | `#E6F7F5` | Low-emphasis evidence chips                                 |
| Information blue | `blue`        | `#2563EB` | Document/search information where teal would imply evidence |
| Safety amber     | `amber`       | `#A15C07` | Warnings and setup                                          |
| Critical red     | `red`         | `#B42318` | Safety-critical states                                      |

### Colour rules

- Page background is true white.
- Sidebars and header bands use `#F7F8FA`, not cream.
- Normal elevated surfaces stay white, with nickel borders.
- Graphite is the main command colour.
- Teal is a signal, not a theme wash.
- Blue is allowed for document/search metadata so teal stays clinical.
- Amber/red are semantic only.

## Type and spacing

- Keep the existing system font stack for implementation safety.
- Use compact, high-confidence headings: semibold, no negative letter spacing.
- Use 8px radius for most controls/cards, 12px only for larger sheets/composer.
- Reduce glow and blur in light mode. White UIs feel premium when details are exact, not when they are glossy.
- Use clear vertical rhythm: dense enough for a clinical workspace, with generous breathing room around the composer and answer surface.

## Signature element

Use a "clinical focus rail":

- A 2px teal rail appears only on the selected mode, active source group, or evidence-backed answer card.
- The rail gives the design a memorable clinical instrument detail without tinting the whole page.
- It is more precise than a soft teal background and should replace broad mint active fills where possible.

## Mockup structure

Desktop:

```text
+ Sidebar rail --+-- White header ------------------------------+
| Graphite CTA   |        Mode control        Utility buttons   |
| Search         +-----------------------------------------------+
| Tools          |                                               |
| Focus rail     |         Answer workspace on white canvas      |
|                |         Cards use nickel borders              |
| Account        |                                               |
+----------------+------------- Floating white composer ---------+
```

Mobile:

```text
+--------------------------------+
| Header: mode + new chat         |
| White canvas                    |
| Answer cards with focus rail    |
| Source chips                    |
| Floating white composer         |
+--------------------------------+
```

## Implementation plan

1. Approve this mockup direction.
2. Replace the light `:root` palette in `src/app/globals.css`:
   - `--background` to `#FFFFFF`.
   - `--surface-subtle` to `#F7F8FA`.
   - `--surface-inset` to `#F1F3F5`.
   - borders to nickel greys.
   - graphite as the primary command colour.
3. Re-map clinical chat aliases:
   - `--clinical-chat-teal` remains teal.
   - `--clinical-chat-teal-soft` becomes a very pale clinical tint.
   - primary CTA should be graphite unless the control is specifically source/evidence/send.
4. Tune material selectors:
   - `.edge-glass-header`
   - `.universal-header`
   - `.universal-header-mode-button`
   - `.universal-header-icon-control`
   - `.answer-footer-search-pill`
   - `.answer-footer-search-action`
   - `.answer-footer-search-chip`
5. Tune clinical hooks:
   - `.clinical-sidebar-primary`
   - `.clinical-sidebar-search-input`
   - `.clinical-sidebar-secondary`
   - `.clinical-sidebar-tool-tile`
   - `.answer-empty-state`
   - `.answer-empty-icon`
   - `.answer-empty-action`
6. Add the clinical focus rail to selected/evidence cards where the component structure allows it without behavioural changes.
7. Verify dark mode after light changes so black polish does not inherit white material rules.

## Verification plan

- Light desktop screenshot: main dashboard.
- Light mobile screenshot: 390px wide.
- Dark desktop screenshot: regression check.
- Route smoke for the mockup.
- `git diff --check`.
- Targeted ESLint on changed mockup route.
- `npm run typecheck` if no existing repo-owned typecheck is already running.
- Contrast spot checks for text, muted text, teal chip, graphite CTA, amber warning, and red critical state.

## Acceptance criteria

- Light mode reads crisp white, not cream, beige, or mint.
- The app feels cleaner and more premium without becoming blank.
- Graphite carries command emphasis.
- Teal communicates clinical evidence/source/action only.
- Borders and shadows create enough hierarchy on a white canvas.
- Mobile stays clean with no horizontal overflow.
- Dark mode remains a paired black-polish system.

## Self-critique and revision

Initial idea: use a faint cool-grey app canvas behind white cards.

Revision: the user asked for crisp white, so the final proposal makes the true app canvas `#FFFFFF` and uses cool grey only for rails, fields, and nested regions. This is a stricter, cleaner direction and a better match for the requested Apple/ChatGPT-inspired polish.
