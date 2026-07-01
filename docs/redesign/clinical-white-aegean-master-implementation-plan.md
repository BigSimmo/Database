# Clinical White / Aegean Graphite Master Implementation Plan

## Final Review Verdict

The permanent direction should be **Clinical White / Aegean Graphite**.

The strongest version of this app is not cream, not green-led, and not a colourful dashboard. It should read as a precise clinical workbench: crisp white canvas, graphite command hierarchy, cool Aegean clinical identity, and restrained semantic status colours.

The final colour system should communicate:

- **Crispness:** true white primary canvas, not porcelain, cream, beige, or mint.
- **Professional weight:** graphite command controls instead of green primary buttons.
- **Clinical identity:** a cool blue-teal Aegean accent used with discipline.
- **Semantic clarity:** green means success only, amber means caution, red means critical, blue means information.
- **Dark-mode continuity:** black polish remains, but the light-mode system becomes cleaner and more premium.

No further palette pivot is recommended. The final perfection is architectural: split command, clinical accent, and success roles so one colour is not doing multiple jobs.

## Permanent Palette

### Light Mode

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--background` | `#FFFFFF` | Main page background |
| Chrome | `--surface-chrome` | `#F7F8FA` | Sidebar, header bands, secondary app frame |
| Raised surface | `--surface-raised` | `#FCFCFD` | Cards, popovers, menus |
| Inset surface | `--surface-inset` | `#F1F4F6` | Inputs, inactive chips, recessed controls |
| Border | `--border` | `#E5E7EB` | Default lines |
| Strong border | `--border-strong` | `#CDD5DF` | Focused panels, active boundaries |
| Ink | `--foreground` | `#101418` | Body text |
| Heading | `--heading` | `#080B0F` | High-emphasis headings |
| Muted text | `--muted-foreground` | `#475467` | Secondary copy |
| Soft text | `--soft-foreground` | `#667085` | Captions and quiet metadata |
| Command | `--command` | `#111827` | Primary command buttons |
| Command hover | `--command-hover` | `#0B1220` | Primary command hover |
| Clinical accent | `--clinical-accent` | `#0B6F86` | Clinical identity, selected state, send action, evidence rail |
| Accent hover | `--clinical-accent-hover` | `#095D70` | Accent hover |
| Accent soft | `--clinical-accent-soft` | `#E7F6F8` | Tiny chips, icon wells, selected hints |
| Accent border | `--clinical-accent-border` | `#B9E4EA` | Subtle selected borders |
| Info | `--info` | `#2563EB` | Informational status |
| Success | `--success` | `#0F7A49` | Ready, connected, passed, complete |
| Warning | `--warning` | `#A15C07` | Caution and missing setup |
| Danger | `--destructive` | `#B42318` | Errors and destructive actions |

### Dark Mode

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--background` | `#060708` | Main dark canvas |
| Chrome | `--surface-chrome` | `#0B0D0F` | Sidebar and header frame |
| Surface | `--surface` | `#101214` | Default panels |
| Raised surface | `--surface-raised` | `#171A1D` | Popovers and cards |
| Inset surface | `--surface-inset` | `#040506` | Inputs and composer body |
| Border | `--border` | `#23282C` | Default dark lines |
| Strong border | `--border-strong` | `#3B454B` | Active/focused dark lines |
| Ink | `--foreground` | `#F5F7F7` | Primary text |
| Muted text | `--muted-foreground` | `#A7B0AD` | Secondary text |
| Soft text | `--soft-foreground` | `#7F8987` | Captions |
| Command | `--command` | `#F5F7F7` | Dark primary command text/surfaces where needed |
| Clinical accent | `--clinical-accent` | `#4CCFD0` | Dark selected/send/evidence identity |
| Accent soft | `--clinical-accent-soft` | `#12383B` | Dark accent wash |
| Accent border | `--clinical-accent-border` | `#235B60` | Dark selected borders |
| Success | `--success` | `#7DE0A3` | Success status |
| Warning | `--warning` | `#F0C15A` | Warning status |
| Danger | `--destructive` | `#FF8D96` | Error/destructive status |

## Final Design Rules

1. **White is the product surface.** The page canvas is `#FFFFFF`. Use `#F7F8FA` only for rails, header bands, quiet chrome, and nested utility zones.
2. **Graphite owns command.** New chat, primary CTAs, high-emphasis neutral actions, and destructive-confirm-safe defaults should not be teal or green.
3. **Aegean owns clinical identity.** Selected mode, evidence/source affordances, focus rails, send action, and clinical scope indicators use `--clinical-accent`.
4. **Green is success only.** Do not use green for brand, active navigation, primary buttons, composer send, selected mode, empty-state hero marks, or evidence surfaces.
5. **Large soft-tinted panels are avoided.** Accent soft backgrounds belong on small chips, icon wells, rails, or tight state badges, not whole cards or page sections.
6. **Use lines before fills.** Premium selected states should prefer a 2px rail, slim underline, icon colour, or border over broad coloured tiles.
7. **Neutral cards stay neutral.** Repeated content cards should be white or raised off-white with nickel borders. The content, icon, or rail can carry the accent.
8. **Dark mode stays black-polished.** Do not copy light-mode glare, white inset highlights, or metallic gradients into dark mode.

## Current Issues To Fix

### 1. Light tokens are still too warm

`src/app/globals.css` still sets the light mode around porcelain and teal. Values like `--background: #f7f7f4` keep the app reading warm and slightly cream instead of crisp white.

### 2. Teal/green is overused

The same colour family appears in sidebar brand elements, sidebar CTA, active tools, header mode controls, menu options, composer send, chips, empty state, and evidence states. This makes the system feel less premium because the accent has no hierarchy.

### 3. `--primary` is overloaded

`src/components/ui-primitives.tsx` uses `--primary` for both primary controls and evidence surfaces. That conflates "do this command" with "this is clinical evidence". This must be split before the palette can feel deliberate.

### 4. Active states rely too much on filled tint

Active navigation and tool states should use rails, borders, icon colour, and type weight. Large teal fills should be reduced.

### 5. Composer must become the best light-mode object

The composer is the most important object on the screen. In light mode it should be a white floating command capsule with nickel border, graphite text, restrained shadow, and Aegean send button. It should not glow green or look washed.

## Implementation Sequence

### Phase 0 - Safety And Baseline

Before app edits:

1. Inspect `git status --short` and avoid overwriting unrelated user work.
2. Keep all current screenshots and mockup artifacts untouched unless explicitly cleaning them later.
3. Read the current diff for these files before editing:
   - `src/app/globals.css`
   - `src/components/ui-primitives.tsx`
   - `src/components/clinical-dashboard/ClinicalSidebar.tsx`
   - `src/components/clinical-dashboard/master-search-header.tsx`
   - `src/components/clinical-dashboard/answer-status.tsx`
   - `src/components/ClinicalDashboard.tsx`
4. Because this is UI work, use `npm run ensure` before browser validation and only attach after `/api/local-project-id` confirms this project.

### Phase 1 - Token Architecture

Edit `src/app/globals.css`.

Add the permanent role tokens in `:root` and `.dark`:

```css
--surface-chrome: #f7f8fa;
--surface: #ffffff;
--surface-raised: #fcfcfd;
--surface-inset: #f1f4f6;
--border: #e5e7eb;
--border-strong: #cdd5df;

--heading: #080b0f;
--foreground: #101418;
--muted-foreground: #475467;
--soft-foreground: #667085;

--command: #111827;
--command-hover: #0b1220;

--clinical-accent: #0b6f86;
--clinical-accent-hover: #095d70;
--clinical-accent-soft: #e7f6f8;
--clinical-accent-border: #b9e4ea;

--info: #2563eb;
--success: #0f7a49;
--warning: #a15c07;
--destructive: #b42318;
```

Use compatibility aliases during migration:

```css
--clinical-chat-teal: var(--clinical-accent);
--clinical-chat-teal-dark: var(--clinical-accent-hover);
--clinical-chat-teal-soft: var(--clinical-accent-soft);
```

Migration rule:

- Do **not** remap `--primary` to `--command` until evidence/source surfaces have moved off `--primary`.
- First add `--command` and `--clinical-accent`.
- Then update callers.
- Then decide whether `--primary` should remain an alias for `--command` or be deprecated.

### Phase 2 - Global Materials

Edit global selectors in `src/app/globals.css`.

Header:

- `.edge-glass-header` uses a flatter white or chrome surface, not a warm translucent gradient.
- `.universal-header` becomes crisp white with a subtle nickel bottom border.
- `.universal-header-mode-button` becomes neutral white/chrome with small Aegean selected details.
- `.universal-header-icon-control` uses neutral hover by default.
- The header "New chat" hover should be graphite/neutral, not teal-filled.

Composer:

- `.answer-footer-search-pill` becomes a white floating capsule.
- Use `border: 1px solid var(--border-strong)` with soft graphite shadow.
- Remove green glow and heavy inset white highlight.
- Focus state uses a restrained Aegean ring or border.
- `.answer-footer-search-send` uses `--clinical-accent` and `--clinical-accent-hover`.
- `.answer-footer-search-action` stays neutral.
- `.answer-footer-search-chip` uses neutral surfaces with optional Aegean icons, not large tinted fills.

Dark mode:

- Keep black surfaces.
- Composer uses `#040506`/`#101214` material, not silver glare.
- Accent becomes `#4CCFD0`.
- Dark chips and controls stay low-glare with clear contrast.

### Phase 3 - Primitive Role Split

Edit `src/components/ui-primitives.tsx`.

Split roles:

- `primaryControl` uses `--command` and `--command-hover`.
- `evidenceSurface` uses `--clinical-accent`, `--clinical-accent-soft`, and `--clinical-accent-border`.
- Success, warning, danger, and info surfaces use semantic tokens only.

Expected outcome:

- Primary command buttons no longer look clinical-accent green.
- Evidence/source affordances no longer inherit command styling.
- Semantic success is visually distinct from selected/evidence.

### Phase 4 - Sidebar Refinement

Edit `src/components/clinical-dashboard/ClinicalSidebar.tsx` and associated CSS.

Sidebar shell:

- Use `--surface-chrome` for the rail.
- Use white/raised nested panels only where content needs elevation.
- Keep borders cool grey.

Brand:

- Brand text is graphite.
- Brand icon can use a small Aegean icon well.
- Avoid making the brand block look like a green status badge.

Primary CTA:

- `.clinical-sidebar-primary` uses graphite command.
- Hover deepens to `--command-hover`.
- Avoid teal/green primary CTA styling.

Navigation/tool states:

- Default items are neutral.
- Active item uses:
  - white tile or very light chrome tile
  - 2px Aegean left rail
  - graphite label
  - Aegean icon
  - no broad teal fill
- Collapsed active buttons follow the same pattern with border/rail/icon treatment.

Status utilities:

- Ready/connected/complete states use `--success`.
- Tool availability or selected clinical modes use `--clinical-accent`.

### Phase 5 - Header And Composer Wiring

Edit `src/components/clinical-dashboard/master-search-header.tsx`.

Header:

- Selected mode icon uses `--clinical-accent`.
- Mode pill itself remains neutral.
- Active menu option should use a left rail, icon colour, or subtle border rather than a full accent wash.
- Header utility buttons stay neutral.
- Header New Chat uses command/graphite styling where it is a primary action.

Composer:

- Send button uses Aegean, not success green.
- Attachment, scope, tools, and mode actions stay neutral until selected.
- Selected chips use accent border or small icon colour, not filled teal blocks.
- Text and placeholder colours use `--foreground`, `--muted-foreground`, and `--soft-foreground`.

Mobile:

- Keep the composer visually light, but with enough border definition against white.
- Confirm footer safe-area spacing and no overlap with mobile navigation.

### Phase 6 - Empty, Answer, Evidence, And Source States

Edit as needed:

- `src/components/clinical-dashboard/answer-status.tsx`
- `src/components/ClinicalDashboard.tsx`
- source/evidence cards or renderers that use `ui-primitives.tsx`

Rules:

- Empty state: white canvas, graphite heading, neutral starter cards, Aegean icons or rails only.
- Evidence/source cards: neutral white cards with Aegean left rail or small status chip.
- Completion/ready badges: success green.
- Missing source/setup: warning amber.
- Errors: destructive red.
- Informational notices: info blue.

Avoid:

- green empty-state hero icons unless the state is complete/success
- full accent-tinted answer cards
- mixed blue/green evidence semantics

### Phase 7 - Component Audit

Search and classify every remaining use of:

```text
--clinical-chat-teal
--clinical-chat-teal-soft
--primary
--emerald
green-
teal-
bg-[var(--primary)]
text-[var(--primary)]
```

For each usage, assign one role:

- command
- clinical accent
- success
- info
- warning
- danger
- neutral

Then migrate to the correct token.

Do not replace mechanically. Some teal usages are correct clinical accent usages; many green usages should become success only or neutral.

### Phase 8 - Accessibility And Contrast

Run contrast checks for:

- graphite on white
- muted text on white
- soft text on white
- white on graphite command
- Aegean on white
- Aegean on accent soft
- success on white
- warning on white
- danger on white
- dark text on dark canvas
- dark accent on dark surfaces

Required minimums:

- Body text: 4.5:1 or better.
- Small UI labels: 4.5:1 or better unless purely decorative.
- Large text and icon-only affordances: 3:1 or better.
- Focus outlines: visible against adjacent background.

Known selected values already pass spot checks, including:

- `#101418` on white: strong body contrast.
- `#475467` on white: strong secondary contrast.
- `#667085` on white: acceptable soft text contrast.
- `#0B6F86` on white and `#E7F6F8`: acceptable accent contrast.
- `#0F7A49` on white: acceptable success contrast.

### Phase 9 - Browser QA Matrix

Use `npm run ensure` first, then verify the project identity through `/api/local-project-id`.

Capture and review:

- Light desktop dashboard.
- Light mobile dashboard.
- Dark desktop dashboard.
- Dark mobile dashboard.
- Sidebar expanded and collapsed.
- Sidebar mobile drawer.
- Header mode menu.
- Composer focused, empty, with chips, and with long prompt text.
- Empty state.
- Generated answer with evidence/source cards.
- Documents/search/results surfaces.
- Settings/account/theme utility area if reachable.

Specific visual checks:

- No cream cast on the main canvas.
- No large teal/green washed panels.
- Primary command action reads graphite.
- Send action reads Aegean.
- Green appears only for success/ready/connected/complete.
- Header and sidebar feel quieter than the main content.
- Composer is the most polished object on the page.
- Dark composer has no metallic glare.
- No text overlap or mobile horizontal scroll.

### Phase 10 - Verification Commands

Recommended sequence after edits:

```powershell
npm run ensure
git diff --check
npm run verify:cheap
npm run verify:ui
```

If `verify:ui` is too broad or already running in another process, run the smallest relevant Playwright targets first, then widen:

```powershell
npx playwright test tests/ui-smoke.spec.ts --project=chromium
npx playwright test tests/ui-accessibility.spec.ts --project=chromium
```

If CSS or Tailwind class generation changes are extensive, also run:

```powershell
npm run build
```

Do not claim release readiness unless `npm run verify:release` is run successfully.

## Acceptance Criteria

The implementation is complete when:

1. Light mode page canvas is true white.
2. Cream/porcelain background tokens are removed from primary app chrome.
3. Graphite is the primary command colour.
4. Aegean is the clinical accent and send/evidence identity colour.
5. Green is limited to success-only states.
6. `--primary` is no longer used for both command controls and evidence surfaces.
7. Sidebar active states use rail/border/icon treatment instead of broad teal fills.
8. Header is calmer and neutral, with only small clinical-accent details.
9. Composer is polished in light and dark mode.
10. Empty, answer, evidence, and source states use role-correct colours.
11. Desktop and mobile screenshots confirm the direction.
12. UI verification and contrast checks pass, or any residual failures are documented as pre-existing or unrelated.

## Implementation Notes

- Keep the first implementation pass token-led and component-scoped.
- Avoid introducing a parallel design system or new dependency.
- Prefer CSS variable role tokens over one-off hex values.
- Avoid broad layout changes unless a colour change exposes spacing or hierarchy problems.
- Preserve the current black-polish dark mode while aligning names and semantics.
- Update screenshots after the implementation so stale mockups do not mislead future review.

## Final Recommendation

Proceed with this palette and token architecture as the permanent direction.

The app should become a crisp white clinical command surface with graphite controls and a disciplined Aegean accent. That combination is the cleanest, most premium, and most durable option for this product.
