# Premium colour system plan

## Goal

Create a light mode that feels modern, premium, calm, and clinically trustworthy without becoming sterile, washed out, or over-teal. Preserve the existing black-polish direction for dark mode, but make both modes feel like one system.

The product context is Clinical Guide: a source-backed clinical workspace used for repeated question answering, document review, medication guidance, and safety checks. The interface should feel like a polished professional tool, not a marketing page.

## Current design findings

### Medium: light mode is still too dependent on teal/mint

Evidence:

- `src/app/globals.css` defines the global light tokens and currently makes `--clinical-chat-teal-soft`, sidebar active states, empty-state cards, mode controls, and composer accents all read from the same teal family.
- `src/components/clinical-dashboard/ClinicalSidebar.tsx` and `src/components/clinical-dashboard/answer-status.tsx` now expose styling hooks, but the system still needs a more disciplined token contract.

Why it matters:

- When the background, active controls, icon tiles, and status chips all share the same green-teal family, light mode reads themed rather than premium.
- Teal should signal clinical action, evidence, and source state. It should not be the whole environment.

Fix:

- Move light mode to a neutral porcelain/graphite foundation.
- Keep teal as an instrument accent for selected mode, source state, send, and clinical evidence.
- Use amber/red only for setup/safety/escalation states.

Verification:

- Desktop and mobile screenshots should read as white/graphite first, teal second.

### Medium: light surfaces need clearer material hierarchy

Evidence:

- The main hierarchy is shared between `globals.css`, `ui-primitives.tsx`, and dashboard-specific overrides in `master-search-header.tsx`, `ClinicalSidebar.tsx`, and `answer-status.tsx`.
- Existing cards, composer, and header use similar borders and shadows, so light mode can look flat or generically frosted.

Why it matters:

- Premium light UIs depend on precise separation: canvas, paper, floating glass, selected control, and warning state need distinct surface rules.

Fix:

- Define four light surfaces: canvas, paper, glass, elevated, and inset.
- Use low-alpha graphite shadows, not teal shadows, for normal elevation.
- Reserve colored shadows for focused/selected controls only.

Verification:

- Empty-state cards should sit above the canvas without looking boxed-in.
- The composer should feel like a floating white glass tool, not a bright pill or a heavy panel.

### Low: dark mode can regress when base header/composer rules are changed

Evidence:

- `globals.css` has shared `.edge-glass-header`, `.universal-header`, and `.answer-footer-search-*` selectors plus `.dark` overrides.

Why it matters:

- Light-mode improvements can accidentally bleed into dark mode if base selectors are changed without matching `.dark` overrides.

Fix:

- Every material-level change to global base selectors must have a paired `.dark` review.
- Add a final dark screenshot after applying the light scheme.

Verification:

- Dark desktop screenshot: header remains black glass, composer remains black-polished, no white glare.

## Proposed colour system

### Light mode: Clinical Porcelain

- Canvas: `#F7F7F4`
- Paper: `#FFFFFF`
- Raised paper: `#FCFCFA`
- Graphite ink: `#111714`
- Muted graphite: `#53605A`
- Hairline border: `#DFDFD8`
- Instrument teal: `#0F766E`
- Soft teal: `#E6F2EF`
- Safety amber: `#8F5408`
- Critical red: `#B23A48`
- Optional cool info: `#2F6F91`

Design role:

- Graphite primary CTA and text give the Apple/ChatGPT-style premium feel.
- Teal is used for clinical/source affordances only.
- Warm porcelain prevents the app from reading as hospital-mint or generic SaaS blue-grey.

### Dark mode: Obsidian Glass

- Canvas: `#070808`
- Surface: `#101214`
- Raised surface: `#171A1D`
- Glass edge: `rgba(255,255,255,0.08)`
- Text: `#F4F7F6`
- Muted text: `#A7B0AD`
- Instrument teal: `#4CCFD0`
- Soft teal: `#12383B`
- Safety amber: `#F0C15A`
- Critical red: `#FF8D96`

Design role:

- Dark remains the black-polished system.
- The same semantic accents are preserved, but lifted for contrast.

## Type and spacing direction

- Keep the existing app font stack for implementation safety.
- Use weight, size, and spacing to create polish rather than introducing a new font dependency.
- Main answer/empty-state headings should use compact, high-confidence typography: semibold, no negative tracking.
- Utility labels stay small, uppercase only where they label system groups such as `Sources`, `Safety`, or `Mode`.

## Signature element

Use a “frosted clinical tray” for the composer and header controls:

- White/dark glass surface.
- Single hairline border.
- Soft graphite elevation.
- Teal send/action affordance.
- No decorative orbs or broad gradients.

This is the memorable material treatment. Everything else should be quiet.

## Implementation sequence

1. Approve a mockup direction.
2. Replace light `:root` tokens in `src/app/globals.css` with the Clinical Porcelain palette.
3. Pair every base material selector with `.dark` review/overrides:
   - `.edge-glass-header`
   - `.universal-header`
   - `.universal-header-mode-button`
   - `.universal-header-icon-control`
   - `.answer-footer-search-pill`
   - `.answer-footer-search-action`
   - `.answer-footer-search-chip`
4. Keep sidebar and empty-state hooks:
   - `.clinical-sidebar-primary`
   - `.clinical-sidebar-search-input`
   - `.clinical-sidebar-secondary`
   - `.clinical-sidebar-tool-tile`
   - `.answer-empty-state`
   - `.answer-empty-icon`
   - `.answer-empty-action`
5. Apply the palette in one pass to dashboard surfaces and source/document panels.
6. Run screenshots:
   - Light desktop home
   - Light mobile home
   - Dark desktop home
   - Documents page light
   - Answer generated light
7. Run checks:
   - `git diff --check`
   - `npm run check:runtime`
   - `npm run typecheck`
   - Focused Playwright screenshot smoke if install state is healthy.

## Acceptance criteria

- Light mode reads neutral premium first, clinical teal second.
- No large green/mint wash over the canvas.
- Header, sidebar, empty state, and composer feel like the same material system.
- Warning/setup states are readable and visually separate from teal action states.
- Dark mode does not inherit light glass or white glare.
- No horizontal overflow on 390px mobile and 1280px desktop.
