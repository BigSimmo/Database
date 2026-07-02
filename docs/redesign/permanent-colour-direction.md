# Permanent colour direction

## Decision

Adopt **Clinical White / Aegean Graphite** as the permanent colour direction.

This is a crisp white, graphite-led interface with a cool blue-teal clinical accent. It replaces the warm cream/porcelain base and demotes green to success-only states.

## Why this direction wins

The app is a source-backed clinical workspace. It should feel precise, calm, premium, and operational. The interface should not feel like a generic medical brand, a mint healthcare template, or a soft editorial product.

The strongest long-term direction is:

- White for clarity.
- Graphite for command and product weight.
- Aegean blue-teal for clinical evidence and source confidence.
- Green only for completion/success.
- Amber and red only for safety states.

This keeps the app clean and crisp while preserving a clinical identity.

## Final palette

### Light mode

| Role | Token | Hex | Purpose |
| --- | --- | --- | --- |
| Canvas | `--background` | `#FFFFFF` | Main app canvas; no cream tint |
| Rail | `--surface-subtle` | `#F7F8FA` | Sidebar rail, header band, quiet nested areas |
| Surface | `--surface` | `#FFFFFF` | Cards, menus, answer panels |
| Raised surface | `--surface-raised` | `#FCFCFD` | Composer, floating controls |
| Inset surface | `--surface-inset` | `#F1F4F6` | Inputs, recessed chips, skeletons |
| Border | `--border` | `#E5E7EB` | Default hairline |
| Strong border | `--border-strong` | `#CDD5DF` | Active/focused boundaries |
| Text | `--text` | `#101418` | Body text |
| Heading | `--text-heading` | `#080B0F` | High-emphasis headings |
| Muted text | `--text-muted` | `#475467` | Secondary text |
| Soft text | `--text-soft` | `#667085` | Metadata and placeholders |
| Command | `--command` | `#111827` | Primary actions and high-emphasis command controls |
| Command hover | `--command-hover` | `#0B1220` | Hover/pressed command state |
| Clinical accent | `--clinical-accent` | `#0B6F86` | Evidence, selected mode, source confidence, send action |
| Clinical accent hover | `--clinical-accent-hover` | `#095D70` | Hover/pressed clinical action |
| Clinical accent soft | `--clinical-accent-soft` | `#E7F6F8` | Small evidence chips and icon tiles only |
| Clinical accent border | `--clinical-accent-border` | `#B9E4EA` | Selected/evidence borders |
| Info | `--info` | `#2563EB` | Document/search information where clinical confidence is not implied |
| Success | `--success` | `#0F7A49` | Ready, complete, connected, passed |
| Warning | `--warning` | `#A15C07` | Setup, caution, review required |
| Danger | `--danger` | `#B42318` | Critical/safety states |

### Dark mode

Keep the black-polish direction and pair it with a brighter cyan-blue accent.

| Role | Token | Hex |
| --- | --- | --- |
| Canvas | `--background` | `#060708` |
| Surface | `--surface` | `#101214` |
| Raised surface | `--surface-raised` | `#171A1D` |
| Inset surface | `--surface-inset` | `#040506` |
| Text | `--text` | `#F5F7F7` |
| Muted text | `--text-muted` | `#A7B0AD` |
| Clinical accent | `--clinical-accent` | `#4CCFD0` |
| Clinical accent soft | `--clinical-accent-soft` | `#12383B` |
| Success | `--success` | `#7DE0A3` |
| Warning | `--warning` | `#F0C15A` |
| Danger | `--danger` | `#FF8D96` |

## Role contract

Do not map every important UI element to the same accent colour.

```css
--command: #111827;
--command-hover: #0B1220;

--clinical-accent: #0B6F86;
--clinical-accent-hover: #095D70;
--clinical-accent-soft: #E7F6F8;
--clinical-accent-border: #B9E4EA;

--success: #0F7A49;
```

Mapping:

- Primary command buttons: `--command`
- Sidebar `New chat`: `--command`
- Selected mode icon: `--clinical-accent`
- Send button: `--clinical-accent`
- Evidence/source state: `--clinical-accent`
- Small evidence chip/icon backgrounds: `--clinical-accent-soft`
- Ready/complete/connected/passed: `--success`
- Document/search metadata: `--info`
- Warnings: `--warning`
- Critical states: `--danger`

## Element decisions

### Sidebar

- Background: rail `#F7F8FA`.
- Brand tile: small clinical accent icon on soft accent.
- `New chat`: graphite command button.
- Active item: white card with a 2px clinical accent rail.
- Tool icons: neutral by default, clinical accent only when active or clinically meaningful.

### Header

- Header material: white or near-white glass, low shadow, nickel border.
- Mode button: neutral white surface with a small clinical accent icon.
- Header action buttons: neutral/graphite, not green.
- Do not use broad accent backgrounds in the header.

### Composer

- White floating capsule.
- Nickel border.
- Graphite text.
- Soft graphite shadow.
- Send button uses clinical accent.
- Remove green glow and broad teal gradients.

### Empty state

- White canvas.
- Graphite heading.
- Neutral starter cards.
- Accent appears only in icons or a 2px focus rail.
- No washed green/mint cards.

### Evidence and sources

- Evidence-backed answer panels use a 2px clinical accent rail.
- Evidence chips can use clinical accent soft.
- Source readiness that means "success" uses success green, not clinical accent.

### Status colours

- Green is only success.
- Amber is only caution/setup/review.
- Red is only critical/safety.
- Blue is information/document/search.

## Contrast check

Spot checks against the final palette:

| Pair | Ratio |
| --- | --- |
| Ink on white | 18.50:1 |
| Muted on white | 7.69:1 |
| Soft on white | 4.97:1 |
| White on graphite | 17.74:1 |
| Clinical accent on white | 5.78:1 |
| Clinical accent on soft accent | 5.21:1 |
| Success on white | 5.38:1 |
| Warning on white | 5.19:1 |
| Danger on white | 6.57:1 |
| Dark text on dark canvas | 18.75:1 |
| Dark accent on dark surface | 9.96:1 |

## Rejected directions

### Warm porcelain

Rejected because it still reads cream/ivory and softens the app too much.

### Green clinical

Rejected because it feels generic healthcare and gives the same colour too many meanings.

### Blue corporate SaaS

Rejected because it loses the clinical/source-backed identity and feels less distinctive.

### Pure monochrome

Rejected because the app still needs a visible evidence/source signal.

## Implementation order

1. Add command and clinical accent tokens to `src/app/globals.css`.
2. Replace the light root palette with the final crisp white values.
3. Keep existing `--primary` temporarily mapped to command for backwards compatibility.
4. Move evidence/source styles from `--primary` to `--clinical-accent`.
5. Update sidebar/header/composer/empty-state hooks.
6. Verify light desktop, light mobile, dark desktop, and generated-answer states.

## Final rule

The app should read as **white, graphite, and precise blue-teal**. Green should only appear when the system is saying something has succeeded.
