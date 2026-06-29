# Clinical Badge System Guide

This guide defines the badge, chip, and compact label system for Clinical KB. Use it as context for future UI, medication, source, document, evidence, answer, and labelling tasks.

This document is governance only. It does not grant approval to apply badges across clinical content. Apply this system to a content area only when that area is explicitly approved for redesign or labelling work.

## Core Principles

Badges should make clinical screens faster to scan. They are not decoration, not a substitute for readable clinical text, and not a way to make every fact look important.

Default to no badge. Add a badge only when removing it would make the screen less scannable, less safe, or less clear.

Badges should answer one of these questions:

| Question | Badge role |
| --- | --- |
| What is this? | Metadata or type |
| What should I do? | Clinical action |
| Can I trust or use this? | Trust, currentness, availability, or source support |
| Should I pause and check? | Caution, adjustment, uncertainty, or review needed |
| Should I stop or avoid? | Contraindication, failure, unsafe state |
| Is the system doing something? | Process or system state |

## Badge Versus Label Versus Chip

Use these terms consistently.

| Term | Meaning | Interaction |
| --- | --- | --- |
| Badge | Compact, static visual marker for state or metadata | Not clickable |
| Chip | Interactive filter, selected token, query token, or mode selector | Clickable/removable/selectable |
| Label | Data classification attached to content, documents, concepts, or rows | May be rendered as text or badge, but is not automatically a UI badge |
| Tag | User-facing classification label, especially for document/manual tagging | May be interactive when used for search/filtering |
| Status | Operational state such as current, processing, failed, reviewed | Usually rendered as a badge |

Static badges must not look clickable. Interactive chips must use proper button or link semantics.

## Master Palette

Use six top-level tones only. Do not add more badge colours.

| Tone | Meaning | Examples | Do not use for |
| --- | --- | --- | --- |
| Neutral / slate | Reference metadata and passive facts | `333 mg EC tablet`, `Item 8357W`, `Campral`, `p.4`, `PDF`, `Max 1,998 mg/day` | Urgent risks, actions, or trust state |
| Clinical / teal | Action to take | `666 mg TID`, `Monitor renal`, `Take with food`, `Check baseline` | Verified/current/source-backed state |
| Success / green | Confirmed, current, available, source-backed | `Reviewed`, `Current`, `Source-backed`, `PBS streamlined`, `Completed` | Clinical safety decisions |
| Warning / amber | Pause, check, adjust, uncertain, limited | `Reduce <60 kg`, `Review due`, `Partial support`, `Limited evidence`, `Avoid >65` | Hard stops or contraindications |
| Danger / red | Stop, avoid, failed, unsafe | `Cr >120 avoid`, `Contraindicated`, `Outdated`, `Failed`, `Do not use` | Routine adverse effects or mild cautions |
| Info / blue | System or process information | `Processing`, `Syncing`, `Pending`, `Importing` | Core clinical meaning |

Do not add purple, pink, orange, cyan, or extra medication-specific badge colours. Orange collapses into amber. Purple should not be used for clinical badges because it reads as product or AI styling rather than clinical meaning.

## Tone Rules

Green means trusted, current, reviewed, available, or source-backed. It does not mean clinically safe.

Teal means a clinical action or instruction. It does not mean good, safe, or verified.

Amber means pause, check, adjust, review, or interpret with caution.

Red means stop, avoid, contraindicated, failed, outdated, or unsafe.

Blue is reserved for system and process state. It should be rare in clinical content.

Neutral is the default for facts that do not require action, caution, trust signalling, or alarm.

## Visual Variants

Use variants within the six tones instead of adding new colours.

| Variant | Use | Visual weight |
| --- | --- | --- |
| Quiet | Default static badge | Lowest |
| Standard | Normal clinical/status badge | Low-medium |
| Strong | Major warning, hard stop, selected interactive chip | High, rare |
| Count | `4 matches`, `12 sources`, `+2` | Compact |
| Dot + label | Very dense status rows | Minimal |

Default badge styling should be quiet.

## Shape And Size

Badges should be compact and stable.

Recommended static badge shape:

- `inline-flex`
- `rounded-md`
- subtle `border`
- low-contrast background tint
- `10-11px` text
- compact horizontal padding
- one line only
- optional icon only when it improves recognition

Avoid:

- oversized pill badges
- heavy shadows
- hover lift on static badges
- button-like padding
- full sentence labels
- wrapping badges across several lines
- icon on every badge

## Interaction Rules

Static badges:

- no pointer cursor
- no hover lift
- no active state
- no button role
- no click handler
- no keyboard focus

Interactive chips:

- use `button`, `a`, or the correct interactive primitive
- have hover and focus-visible states
- have accessible names
- show selected/removable state clearly
- may use larger padding than static badges

Do not use the same component for static badges and interactive chips unless it has explicit modes and safe defaults.

## Density Rules

Badges are easy to overuse. Apply hard limits.

| Context | Limit |
| --- | --- |
| Desktop detail row | 3 visible badges |
| Mobile detail row | 2 visible badges |
| Search result row/card | 2-3 visible badges |
| Top summary tile | 0 badges |
| Hard-stop safety row | Up to 4 red badges if each is a separate contraindication |
| Source/evidence row | 2-3 badges |
| Document tag cloud | Use tag limits and show-more behaviour |

When there are too many badges, show the highest-priority badges first and move the rest into expanded detail or a quiet count such as `+2`.

Priority order:

1. Danger
2. Warning
3. Clinical
4. Success
5. Neutral
6. Info

## Placement Rules

Do not put badges in top medication summary tiles. Those should use icon, label, value, and muted subline only.

Use badges inside:

- medication detail rows
- medication search result metadata
- source and evidence state
- document search result metadata
- answer grounding state
- admin/import/indexing status
- compact count areas

Avoid badges inside:

- prose paragraphs
- every bullet
- headings already visible nearby
- primary navigation
- buttons that already have clear labels
- hero/home prompt areas unless representing a selected token or filter chip

## Badge Text Rules

Badge labels must be short, clinical, and scannable.

Good labels:

- `666 mg TID`
- `Max 1,998 mg/day`
- `Reduce <60 kg`
- `Cr >120 avoid`
- `Reviewed`
- `PBS streamlined`
- `Current`
- `Source-backed`
- `Review due`
- `Partial support`

Poor labels:

- `This medication should not be used in patients with renal impairment`
- `The document appears to be source backed by the uploaded guideline`
- `You should check renal function before prescribing this medication`
- `This is probably relevant`

Prefer nouns and concise clinical phrases. Use full prose in the row body, not in the badge.

## Clinical Safety Rules

Critical clinical information must not be badge-only. If a contraindication is shown as a red badge, it must also appear in readable text.

Badges highlight. They do not replace:

- prescribing answer text
- contraindication detail
- dose adjustment instructions
- monitoring requirements
- source provenance
- patient-specific context

Use red only for true stop or failure states. Routine side effects are not red unless they imply stop/avoid/escalation.

## Medication Rules

Medication pages may use badges only where they improve scanning.

| Medication content | Tone |
| --- | --- |
| Formulation | Neutral |
| Brand | Neutral |
| PBS item | Neutral |
| PBS availability/streamlined | Success |
| Reviewed/source-backed medication state | Success |
| Usual dose as an instruction | Clinical |
| Administration instruction | Clinical |
| Monitoring action | Clinical |
| Dose ceiling/reference max dose | Neutral |
| Dose adjustment | Warning |
| Renal/hepatic caution | Warning |
| Population not established | Warning |
| Contraindication/do not use | Danger |
| Routine adverse effect | Neutral |
| High/common adverse effect needing attention | Warning |
| Serious adverse effect/stop state | Danger |

Acamprosate examples:

| Label | Tone | Reason |
| --- | --- | --- |
| `333 mg EC tablet` | Neutral | Formulation |
| `PBS streamlined` | Success | Access/status |
| `Reviewed` | Success | Trust/status |
| `666 mg TID` | Clinical | Dosing instruction |
| `2 x 333 mg` | Neutral | Dose detail |
| `Max 1,998 mg/day` | Neutral | Reference ceiling |
| `Reduce <60 kg` | Warning | Dose adjustment |
| `Take with food` | Clinical | Administration instruction |
| `Do not crush` | Warning | Administration caution |
| `Cr >120 avoid` | Danger | Contraindication |
| `Child-Pugh C` | Danger | Contraindication |

## Search Result Rules

Medication and document search results should stay search-focused.

Use at most:

- one match/relevance badge
- one clinical metadata badge
- one caution/action badge if needed

Do not show a large badge cluster in a result row. If every result has many badges, the page becomes a detail page instead of search results.

Search match examples:

| Label | Tone |
| --- | --- |
| `Exact match` | Success |
| `Source-backed` | Success |
| `Partial support` | Warning |
| `Nearby only` | Warning |
| `No direct support` | Warning or danger depending on context |
| `Dose match` | Clinical or success depending on whether it is an action or evidence state |

## Answer And Evidence Rules

Answer badges should clarify grounding and evidence strength.

| Evidence state | Tone |
| --- | --- |
| Direct source-backed support | Success |
| Strong source | Success |
| Partial support | Warning |
| Nearby only | Warning |
| No direct support where direct support is required | Danger |
| Source current | Success |
| Source review due | Warning |
| Source outdated | Danger |
| Page/source metadata | Neutral |

Do not use badges to decorate answer prose. Use them at the answer header, source rows, evidence panels, and compact provenance areas.

## Source And Document Rules

Document labels and document badges are related but not the same.

Document labels classify the document. UI badges render only selected labels or states that help the user scan.

| Source/document item | Tone |
| --- | --- |
| Site/organisation metadata | Neutral or info if operationally helpful |
| Document type | Neutral |
| Manual override | Info |
| Needs review | Warning |
| Ambiguous site | Warning |
| Current source | Success |
| Review due | Warning |
| Outdated source | Danger |
| Processing/indexing | Info |
| Failed ingestion | Danger |
| Indexed/completed | Success |

Limit visible tags. Use show-more behaviour for document tag clouds.

## Admin And Ingestion Rules

Operational status badges should be simple and consistent.

| State | Tone |
| --- | --- |
| Queued | Neutral |
| Processing | Info |
| Completed/indexed | Success |
| Needs review | Warning |
| Low confidence | Warning or info depending on severity |
| Duplicate/noisy | Warning |
| Failed | Danger |

Do not make operational process badges look like clinical safety badges. Keep copy explicit.

## Labelling Task Guide

When performing a labelling task, decide whether each item is:

1. A data label.
2. A UI badge.
3. A search/filter chip.
4. Plain text.
5. Not needed.

Use this decision path:

1. Is the label needed for retrieval, grouping, or data governance?
   - If yes, create or update a data label.
2. Is the label needed for fast visual scanning in the UI?
   - If yes, render a badge or chip.
3. Is it interactive?
   - If yes, it is a chip/filter/tag button, not a static badge.
4. Is it critical clinical information?
   - If yes, include readable text first; badge may supplement it.
5. Is it only decorative or repeating nearby text?
   - If yes, do not badge it.

Labelling tasks must not infer permission to redesign every content area. Apply badge rendering only to explicitly approved screens or content types.

## Approval Scope Rules

Allowed without additional approval:

- Create or update this guide.
- Propose badge mappings.
- Apply badge improvements to a content area the user explicitly names and approves.
- Refactor shared badge primitives if the user asks to implement the guide.

Not allowed without explicit approval:

- Broadly relabel all clinical content.
- Apply badge mappings to all existing medication/source/answer content.
- Change clinical facts or source meaning.
- Promote generated labels into clinical decisions.
- Add new badge colours.
- Make static badges interactive.

## Component Guidance

The app should move toward two shared primitives:

1. `SemanticBadge`
   - static
   - semantic tone
   - quiet/standard/strong/count/dot variants
   - safe truncation
   - optional icon

2. `InteractiveChip`
   - interactive
   - selected/removable/filter modes
   - focus-visible state
   - keyboard accessible

Recommended semantic tone names:

```ts
type BadgeTone = "neutral" | "clinical" | "success" | "warning" | "danger" | "info";
type BadgeVariant = "quiet" | "standard" | "strong" | "count" | "dot";
```

Avoid code-facing colour names such as `green`, `red`, `amber`, or `slate` for new badge APIs. Use semantic names so future contributors select tone by meaning, not hue.

Map semantic tones to existing tokens:

| Semantic tone | Existing style direction |
| --- | --- |
| `neutral` | `toneNeutral` / metadata pill |
| `clinical` | clinical teal token |
| `success` | `toneSuccess` |
| `warning` | `toneWarning` or `toneWarningQuiet` |
| `danger` | `toneDanger` |
| `info` | `toneInfo` |

## Accessibility Requirements

Badges must remain understandable without colour.

Requirements:

- clear text label
- colour plus text, not colour alone
- icon only when useful
- high enough contrast in light and dark mode
- forced-colors support
- no clipped critical labels
- no badge-only clinical risks
- static badges should not receive keyboard focus
- interactive chips must be keyboard accessible

## Content Quality Checklist

Before adding a badge, ask:

- Is this fact important enough to scan visually?
- Is the same text already obvious nearby?
- Is the tone based on meaning, not visual preference?
- Would this badge still make sense without colour?
- Can it fit on a phone?
- Is the label under 18-22 characters where possible?
- Does the row stay readable if the badge is removed?
- Is critical clinical content also present in prose?
- Is this badge static, or should it be an interactive chip?
- Has this content area been approved for badge implementation?

## Visual QA Checklist

Check every badge implementation at:

- narrow phone width
- desktop width
- dark mode
- forced-colors mode
- long labels
- empty/missing values
- high badge counts
- row hover/focus states
- keyboard navigation for chips
- screen-reader names for interactive chips

Failures to fix:

- text clipped in a clinically unsafe way
- badge wraps into awkward multi-line clusters
- static badge looks clickable
- row height increases because of low-priority badges
- red/amber overused
- green implies safety
- blue used for clinical meaning
- content depends on colour alone

## Anti-Patterns

Avoid:

- badge every medication fact
- badge every answer bullet
- use green for "safe"
- use red for routine side effects
- use teal for verified/current
- use blue for clinical action
- add purple for AI
- add orange beside amber
- put badges in top decision tiles
- use badges as buttons
- use full sentences in badges
- show five or more badges in a mobile row
- let badge clusters turn search results into detail pages

## Quick Reference

Use this mapping by default:

| If the label means... | Use tone |
| --- | --- |
| Passive fact | Neutral |
| Clinical instruction | Clinical |
| Current/reviewed/source-backed/available | Success |
| Adjustment/caution/review/partial | Warning |
| Avoid/contraindicated/failed/unsafe | Danger |
| Processing/pending/system | Info |

Use fewer badges than feels tempting. The goal is clinical scanning, not visual decoration.
