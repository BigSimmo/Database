# Clinical KB — build conventions

## Setup

No provider is required — every component renders standalone. Styling comes
entirely from `styles.css` (compiled Tailwind v4 + design tokens): make sure it
is loaded. Fonts are Geist (UI) and Geist Mono (codes/numbers), shipped in the
bundle; body text inherits `var(--font-sans)` from the stylesheet.

## Styling idiom

Tailwind utility classes, with **all colour/shadow through CSS variables** in
arbitrary-value form — never hardcoded colours:

- Text: `text-[color:var(--text)]`, `--text-heading`, `--text-muted`, `--text-soft`
- Surfaces: `bg-[color:var(--surface)]`, `--surface-raised`, `--surface-inset`, `--surface-subtle`, `--surface-lux`, `--surface-wash`
- Borders: `border-[color:var(--border)]`, `--border-strong`, `--border-lux`
- Accent (primary action colour): `--clinical-accent`, `--clinical-accent-hover`, `--clinical-accent-active`, `--clinical-accent-soft`, `--clinical-accent-border`, `--clinical-accent-contrast`
- Command (primary buttons): `--command`, `--command-hover`, `--command-contrast`
- Status: `--danger-text/-bg/-border/-solid/-solid-contrast`, plus the same
  families for `success`, `warning`, `info` (e.g. `--success-text`)
- Elevation: the `--e0` … `--e4` ladder — `shadow-[var(--e2)]`, `hover:shadow-[var(--e3)]`.
  `--e0` flush · `--e1` resting hairline · `--e2` cards/popovers · `--e3` hover/lifted chrome ·
  `--e4` modals/sheets/drawers. The role names are aliases onto tiers:
  `--shadow-tight`→`--e1`, `--shadow-card`/`--shadow-soft`→`--e2`, `--shadow-hover`→`--e3`,
  `--shadow-elevated`/`--shadow-lux`→`--e4`. `--shadow-inset` stays bespoke.
  Never hand-roll a `shadow-[0_…]` literal.
- Focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]`.
  Outline only — never add a companion `focus:ring-*` / `box-shadow`. The shared base rule is one
  focus owner by design; a second ring both stacks a halo and wipes the control's resting elevation.

Radius rules: `rounded-md` chips/pills, `rounded-lg` controls/cards/panels,
`rounded-xl` sheets/dialogs. Tap targets: `min-h-tap` / `h-tap w-tap` (44px).
Dark mode is automatic via the `.dark` class — the variables flip; never write
`dark:` colour overrides yourself.

## Class-string vocabulary (exported constants)

The bundle exports ready-made class strings — compose them instead of
re-deriving surfaces: `panel`, `panelSubtle`, `raisedCard`, `sourceCard`,
`answerSurface`, `primaryControl`, `floatingControl`, `toolbarButton`,
`navPill`, `metadataPill`, `subtleStatusPill`, `shellChip`, `fieldLabel`,
`fieldControl`, `fieldControlWithIcon`, `fieldControlPlain`, `fieldIcon`,
`eyebrowText`, `textMuted`, `proseMeasure`, `codeText`, `iconTilePremium`,
`clinicalDivider`, `tableCard`, `tableCardHeader`, plus the chat/search
composer and tone recipes documented in
`docs/redesign/09-ui-primitives-recipes.md`. Join with the exported `cn(...)`
helper.

Module-private helpers (`insetCard`, `iconTile`, `compactMetadataRow`,
`toneWarningQuiet`, `controlBase`, `statusDotBase`, `chatComposerShellDelta`)
power components inside `ui-primitives.tsx` and are **not** part of the import
surface — use the exported components (`LoadingPanel`, `PanelHeading`,
`SourceProvenance`, `SourceStatusBadge`, …) or the exported recipes above.

## Example

```tsx
import { PanelHeading, panelSubtle, primaryControl, cn, FileText } from "<pkg>";

<section className={cn(panelSubtle, "p-4 space-y-3")}>
  <PanelHeading icon={FileText} title="Document library" description="Indexed guidelines and protocols." />
  <button className={primaryControl}>Upload document</button>
</section>;
```

## Icons

The bundle ships a curated lucide icon set — import icons from the package
itself, never from `lucide-react` (it is not available to designs): `Search`,
`SearchX`, `FileText`, `File`, `Inbox`, `Upload`, `Download`, `ShieldCheck`,
`ShieldAlert`, `TriangleAlert`, `AlertCircle`, `Ban`, `X`, `Check`,
`CheckCircle2`, `Info`, `Loader2`, `ChevronDown`, `ChevronRight`, `ArrowLeft`,
`ArrowRight`, `Plus`, `Trash2`, `Pencil`, `Filter`, `Settings`, `Database`,
`BookOpen`, `Stethoscope`, `HeartPulse`, `Pill`, `Calendar`, `Clock`,
`ExternalLink`, `Copy`, `Maximize2`. The `icon` prop on `PanelHeading` /
`EmptyState` is optional — omit it rather than inventing an icon.

## Where the truth lives

Read `styles.css` for the full token set (`:root` and `.dark` blocks) and each
component's `.d.ts` + `.prompt.md` for its API.
