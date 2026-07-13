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
- Accent (primary action colour): `--clinical-accent`, `--clinical-accent-hover`, `--clinical-accent-soft`, `--clinical-accent-border`, `--clinical-accent-contrast`
- Command (primary buttons): `--command`, `--command-hover`, `--command-contrast`
- Status: `--danger-text/-bg/-border/-solid/-solid-contrast`, plus the same
  families for `success`, `warning`, `info` (e.g. `--success-text`)
- Shadows: `shadow-[var(--shadow-tight)]`, `--shadow-soft`, `--shadow-hover`, `--shadow-inset`, `--shadow-lux`
- Focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]`

Radius rules: `rounded-md` chips/pills, `rounded-lg` controls/cards/panels,
`rounded-xl` sheets/dialogs. Tap targets: `min-h-tap` / `h-tap w-tap` (44px).
Dark mode is automatic via the `.dark` class — the variables flip; never write
`dark:` colour overrides yourself.

## Class-string vocabulary (exported constants)

The bundle exports ready-made class strings — compose them instead of
re-deriving surfaces: `panel`, `quietPanel`, `glassPanel`, `raisedCard`,
`insetCard`, `sourceCard`, `evidenceSurface`, `primaryControl`,
`floatingControl`, `toolbarButton`, `navPill`, `metadataPill`, `shellChip`,
`fieldLabel`, `fieldControl`, `fieldControlPlain`, `eyebrowText`, `textMuted`,
`proseMeasure`, `codeText`, `compactMetadataRow`, `iconTile`, `clinicalDivider`.
Join with the exported `cn(...)` helper.

## Example

```tsx
import { PanelHeading, quietPanel, primaryControl, cn } from "<pkg>";
import { FileText } from "lucide-react";

<section className={cn(quietPanel, "p-4 space-y-3")}>
  <PanelHeading icon={FileText} title="Document library" description="Indexed guidelines and protocols." />
  <button className={primaryControl}>Upload document</button>
</section>
```

## Where the truth lives

Read `styles.css` for the full token set (`:root` and `.dark` blocks) and each
component's `.d.ts` + `.prompt.md` for its API. Icons are `lucide-react`
components passed as the `icon` prop where accepted.
