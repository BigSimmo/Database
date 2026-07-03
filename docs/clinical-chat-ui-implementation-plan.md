# Clinical Chat UI Implementation Plan

Date: 2026-06-23

> **Revised 2026-07-03 — colour aligned to Clinical White / Aegean Graphite.** The functional-colour and colour-specification sections below have been rewritten in-body onto the role-split token system: `--command` (graphite) for primary command, `--clinical-accent` (Aegean blue-teal) for clinical identity (evidence/selected/send/focus), and `--success` (green) for status only. See [`redesign/02-design-direction.md`](redesign/02-design-direction.md) and [`redesign/permanent-colour-direction.md`](redesign/permanent-colour-direction.md). The layout, interaction, and iteration plan are unchanged from the original 2026-06-23 draft.

## Purpose

This document captures the agreed implementation plan for mapping the final ChatGPT-inspired clinical chatbot mockups into the application faithfully. It is intentionally written before code changes so implementation can proceed in controlled visual slices with clear acceptance criteria.

The goal is not to rebuild the product. The goal is to reskin and reorganize the current Clinical KB interface so it feels like a polished, native chat assistant while preserving the existing clinical search, document, evidence, upload, source, table, image, PDF, and tool capabilities.

## North star

The app should feel like a clean clinical ChatGPT-style assistant:

- The natural-language answer is the primary visual object.
- Evidence is available but quiet by default.
- Clinical notes appear only when clinically meaningful.
- Tools are accessible through the sidebar and `+` menu, not scattered through the answer.
- Mobile is stricter and more minimal than desktop.
- Colour is conservative and functional, never decorative.
- All source, evidence, table, image, and PDF behavior remains discoverable.

## Non-goals

- Do not change answer generation, search ranking, source governance, ingestion, Supabase behavior, or API logic unless a UI integration blocker requires it.
- Do not remove existing evidence types.
- Do not remove document management, upload, setup, or indexing workflows; move admin/setup affordances out of daily chat surfaces.
- Do not implement a visual rewrite in one large pass.
- Do not introduce a new icon library unless the existing icon set cannot support the final mapping.
- Do not make dark mode the default design direction.

## Design principles

### 1. Answer first

The main assistant response must read as a natural-language clinical answer. It should not be blocked by clinical cards, large source sections, or dashboard panels.

Default answer order:

1. Natural-language paragraph.
2. Stateful source capsule.
3. Tiny answer action row.
4. Key points or bullets.
5. Optional `More detail`.
6. Conditional `Clinical notes`.
7. Collapsed `Evidence`.
8. Optional table card only when central to the question.
9. Related follow-up chips.

### 2. Evidence quiet by default

Default evidence should be represented by:

- One source capsule in the answer.
- One collapsed Evidence row.

Richer details should appear only after click/tap.

Desktop source capsule:

```text
Source-backed · 3 sources ˅
```

Mobile source capsule:

```text
3 sources ˅
```

Weak or unsupported states:

```text
Check sources ˅
No direct source
```

### 3. Tools on demand

Daily-use tools should live in:

- Desktop sidebar.
- `+` composer menu.
- Mobile `+` bottom sheet.

Daily `+` menu actions:

- Search library.
- Add document.
- Scope.
- Evidence.
- Clinical tools.

Admin/setup/indexing/readiness controls should remain in Settings, Guide, upload/indexing drawers, or error states, not in the daily `+` menu.

### 4. Functional colour only

Colour communicates state or meaning through role tokens, never decoration. The accent is role-split: graphite carries command, Aegean carries clinical identity.

- `--command` (graphite): primary action, New chat, primary CTAs. Command is never teal or green.
- `--clinical-accent` (Aegean): active Answer tab, source-backed/evidence state, send button, focus.
- `--clinical-accent-soft`: the quiet active/source-backed wash and small evidence chips.
- Clinical notes: a neutral quiet surface (`--surface-subtle`); safety/caution content inside uses `--warning`/`--danger`, not a warm tint.
- `--info` (blue): document/search surfaces where clinical confidence is not implied.
- `--warning` dot: review due/older source status only.
- `--success` dot: ready/current/profile status only.
- Muted/neutral dot: low-confidence/OCR uncertainty only.

Avoid decorative colour, avoid colouring every chip, and do not map both command and clinical identity to a single accent.

### 5. Mobile is stricter

Mobile should show less than desktop:

- No mobile title in the header.
- Header: hamburger, Answer/Documents, source scope, new chat.
- Short source capsule.
- Two collapsed rows only: Clinical notes and Evidence.
- `+` sheet closed by default.
- No bottom navigation.
- 44px minimum touch targets.

## Typography specification

Use one calm humanist sans direction throughout, aligned with the current app font stack where possible. The target feel is Geist/Sohne-like: high x-height, readable clinical prose, not decorative.

Recommended scale:

| Use              | Size    | Weight  | Line height | Notes                             |
| ---------------- | ------- | ------- | ----------- | --------------------------------- |
| Page/app title   | 18-20px | 600     | 1.25        | Desktop sidebar/header only       |
| Section heading  | 15-17px | 600     | 1.35        | Keep compact                      |
| Answer paragraph | 15-16px | 450-500 | 1.55-1.7    | Primary reading surface           |
| Bullets          | 14-15px | 450-550 | 1.55-1.65   | No bullet icons                   |
| Sidebar labels   | 13px    | 500-600 | 1.3         | Icons secondary                   |
| Metadata/chips   | 12-13px | 500-600 | 1.25        | Avoid tiny unreadable text        |
| Table header     | 12-13px | 600     | 1.25        | Neutral surface header            |
| Table cells      | 12-13px | 450-500 | 1.35        | Accessible expanded view required |
| Mobile composer  | 15-16px | 400-500 | 1.3         | Prevent mobile zoom               |

Reading constraints:

- Desktop answer max width should be around `68ch`.
- Mobile answer should use comfortable line-height and avoid dense full-width cards.
- Avoid uppercase except for very small metadata labels.

## Colour specification

Use the Clinical White / Aegean Graphite role tokens defined in `src/app/globals.css` (full palette and dark-mode values in [`redesign/permanent-colour-direction.md`](redesign/permanent-colour-direction.md)). Reference the tokens, not raw hex; the light values below are for orientation only.

| Role token                       | Light value           | Use                                                                             |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `--command`                      | `#111827`             | primary action, New chat, primary CTAs                                          |
| `--command-hover`                | `#0B1220`             | command hover/pressed                                                           |
| `--clinical-accent`              | `#0B6F86`             | active Answer tab, send, source capsule text/border, focus                      |
| `--clinical-accent-soft`         | `#E7F6F8`             | active tab / source capsule / small evidence chip wash                          |
| `--clinical-accent-border`       | `#B9E4EA`             | selected/evidence borders                                                       |
| `--info`                         | `#2563EB`             | document/search signal (no clinical confidence implied)                         |
| `--success`                      | `#0F7A49`             | ready/current/high-confidence dot only                                          |
| `--warning`                      | `#A15C07`             | review-due/older source dot; caution states                                     |
| `--danger`                       | `#B42318`             | critical/safety states only                                                     |
| `--surface` / `--surface-subtle` | `#FFFFFF` / `#F7F8FA` | canvas and quiet nested surfaces (documents mode, table header, clinical notes) |
| `--text` / `--text-heading`      | `#101418` / `#080B0F` | primary text and headings                                                       |

Rules:

- The accent is role-split: `--command` (graphite) carries primary command; `--clinical-accent` (Aegean) carries clinical identity (evidence/selected/send/focus). Do not collapse both into one accent.
- The canvas is true white — no warm sand/cream tint. Clinical notes and other nested areas use neutral `--surface-subtle`, not a coloured panel.
- Amber (`--warning`) must not appear as a large background unless there is a serious warning.
- Green (`--success`) is success/ready only; source-backed state uses `--clinical-accent`, never green.

## Icon specification

Use one thin-line icon family throughout, ideally the existing lucide set. Stroke, size, and style should be consistent.

Size rules:

- Sidebar tool icons: 16px.
- Header/composer icons: 18px.
- Mobile icons: 18px inside 44px+ targets.
- Table/evidence micro-actions: 14-16px.

Answer icon rule:

The answer area should include only:

- Assistant shield/avatar.
- Source capsule chevron.
- Copy.
- Ellipsis.

Do not put icons beside every bullet or source metadata item.

Mapping:

| Feature        | Icon                              |
| -------------- | --------------------------------- |
| New chat       | plus in rounded square            |
| Search library | magnifying glass                  |
| Scope          | filter/funnel or globe-filter     |
| Evidence       | stacked layers                    |
| Clinical notes | clipboard/check                   |
| Documents      | file text                         |
| Images         | image                             |
| Tables         | grid/table                        |
| PDFs           | file badge                        |
| Clinical tools | toolkit or stethoscope, sparingly |
| Guide          | question circle                   |
| Settings       | gear                              |
| Profile        | initials only                     |

Status:

- Use dots instead of warning icons in normal source metadata.
- `--success` dot: current/high confidence.
- `--warning` dot: review due/older source.
- Muted/neutral dot: low confidence/OCR uncertainty.

## Component mapping

Likely primary files:

- `src/components/ClinicalDashboard.tsx`
- `src/components/clinical-dashboard/master-search-header.tsx`
- `src/components/clinical-dashboard/dashboard-shell.tsx`
- `src/components/clinical-dashboard/answer-status.tsx`
- `src/components/ui-primitives.tsx`
- `src/app/globals.css`

Mapping:

| Current area               | Final design role                                         |
| -------------------------- | --------------------------------------------------------- |
| MasterSearchHeader         | simplified top bar, Answer/Documents, scope, composer     |
| ClinicalDashboard          | app shell, sidebar, answer/evidence/document layout       |
| UtilityDrawer              | standard collapsed row / desktop accordion / mobile sheet |
| AnswerEmptyState           | quiet starter state                                       |
| VisualEvidenceStrip        | evidence drawer Images/Tables sections                    |
| QuoteCards                 | evidence drawer Quotes section                            |
| SourceList                 | evidence drawer Sources section                           |
| DocumentSearchResultsPanel | Documents mode result cards                               |
| AccessibleTable            | compact inline table and accessible expanded table        |

## Final default UI states

All of these should be true in the default production answer screen:

- `+` menu closed.
- Evidence collapsed.
- Clinical notes collapsed.
- Source popover closed.
- Table visible only when central to the query.
- No sticky evidence mini-context on desktop.
- No mobile bottom navigation.
- No Documents mode preview inside Answer mode.
- No admin/readiness/indexing controls in the daily `+` menu.

## Feature behavior requirements

### Source capsule

Default:

- Desktop: `Source-backed · 3 sources ˅`
- Mobile: `3 sources ˅`

States:

- Strong support: `Source-backed · N sources ˅`
- Weak support: `Check sources ˅`
- Unsupported: `No direct source`

Click behavior:

1. First click opens paragraph preview.
2. Preview shows title, page, short excerpt, source status dots, Open PDF drawer, Copy quote, View section.
3. PDF drawer opens only from explicit action.

### Evidence drawer

Collapsed desktop row:

```text
Evidence · 3 sources · 4 quotes · More
```

Collapsed mobile row:

```text
Evidence · 3 sources · 4 quotes · More
```

Do not show tables/images/PDF counts in mobile collapsed state.

Opened tab order:

For table questions:

```text
Tables, Sources, Images, Quotes, PDFs, Map
```

For normal questions:

```text
Sources, Quotes, Tables, Images, PDFs, Map
```

Evidence sections:

- Tables: compact rows, actions Expand, Source, Copy.
- Sources: ranked list with status dots.
- Images: row `Images N`, thumbnails only when Images is opened.
- Quotes: source quote cards.
- PDFs: all PDFs used by answer, ranked Main source / Supporting source / Mentioned source.
- Map: evidence relationship view.

### Clinical notes

Show only if answer includes:

- safety issue
- monitoring requirement
- escalation point
- contraindication/caution

Default row:

```text
Clinical notes 2
```

Style:

- Neutral quiet surface (`--surface-subtle`) only — no warm sand tint.
- Right chevron.
- Compact collapsed default.

### Table card

Show inline only when central to query.

Title:

```text
Clozapine monitoring schedule
```

Do not show long captions in chat. Full caption lives inside Evidence.

Footer:

```text
Expand · Source · Copy · ⋯
```

### Copy

Answer-level Copy:

- Copies natural answer only.

Evidence-level copy:

- Copy quote.
- Copy table.
- Copy sources.

### Documents mode

When Documents is selected:

- Composer placeholder changes to `Search your clinical documents...`.
- Main area shows document result cards.
- No assistant answer is shown unless user switches back to Answer.

Document card:

- title
- best pages
- source status dot
- tags
- short excerpt
- Open
- Ask from this
- Scope

### Empty state

Main canvas before query:

- Ask a question
- Search documents
- Upload document

Recent chats remain in sidebar.

## Accessibility requirements

- Mobile touch targets at least 44px.
- Visible focus rings for buttons, inputs, source capsule, accordions.
- Accordions have accessible labels and state.
- Chevrons consistent and right aligned.
- Table has accessible expanded view.
- Source preview is keyboard reachable and dismissible.
- Text contrast remains high.
- Motion respects reduced-motion preferences.

## Motion requirements

Use subtle motion only:

- Bottom sheet slides up.
- Source popover fades/scales.
- Accordions expand smoothly.

Avoid:

- bouncy motion
- decorative motion
- repeated shimmer after loading completes

## Iteration plan

### Iteration 1: design tokens and primitives

Scope:

- Typography scale.
- Functional colour tokens.
- Icon sizing.
- Source capsule primitive.
- Evidence row primitive.
- Clinical notes row primitive.
- Composer primitive.
- Table micro-action style.

Acceptance:

- Components can render final states without touching data logic.
- Visual tokens are centralized enough to avoid one-off styling.

### Iteration 2: desktop shell and sidebar

Scope:

- Persistent desktop sidebar.
- Collapsible icon rail.
- Top tools + View all tools.
- Recent chats placement.
- Guide/help/settings/profile placement.

Acceptance:

- Sidebar feels useful but lighter.
- Collapsing gives more chat width.

### Iteration 3: header and composer

Scope:

- Simplified top bar.
- Answer/Documents selector.
- Explicit scope text.
- Clean composer.
- Daily `+` menu closed by default.

Acceptance:

- Header is not dashboard-like.
- Composer feels native and minimal.

### Iteration 4: answer and clinical notes

Scope:

- Natural answer first.
- Stateful source capsule.
- Copy row.
- Plain bullets.
- More detail.
- Conditional Clinical notes.

Acceptance:

- Answer is readable before all other objects.
- Clinical notes are helpful but not dominant.

### Iteration 5: evidence drawer and source preview

Scope:

- Collapsed Evidence default.
- Adaptive tab ordering.
- Sources, Quotes, Tables, Images, PDFs, Map sections.
- Source preview before PDF drawer.

Acceptance:

- Evidence feels powerful but quiet.
- Images/PDFs/tables are included naturally.

### Iteration 6: tables and documents mode

Scope:

- Optional inline table card.
- Accessible table expansion.
- True Documents mode search.
- Document result cards.

Acceptance:

- Table does not duplicate full evidence drawer.
- Documents mode is clearly search, not chat.

### Iteration 7: mobile refinement

Scope:

- No mobile title.
- Short source capsule.
- Collapsed rows only.
- Mobile `+` sheet.
- 44px targets.
- No bottom nav.

Acceptance:

- Phone feels native, calm, and spacious.

### Iteration 8: screenshot comparison and polish

Scope:

- Desktop default.
- Desktop sidebar collapsed.
- Mobile default answer.
- Mobile `+` sheet.
- Evidence open.
- Source preview.
- Documents mode.
- Empty state.

Acceptance:

- Screens match mockups closely.
- Spacing, typography, and colour are adjusted after comparison.

## Final quality gate

Before calling the UI implementation complete:

- Main default chat matches final mockup direction.
- Natural answer is visually primary.
- Source capsule is stateful.
- Evidence is collapsed by default.
- Evidence drawer includes images, tables, PDFs, quotes, sources, map.
- Clinical notes are conditional.
- Table only shows inline when central.
- Documents mode is true search.
- `+` menu is daily-use only.
- Mobile has no title and no bottom nav.
- Icons are consistent.
- Colour is functional and conservative.
- Accessibility basics are intact.
- No backend/search behavior was unintentionally changed.
