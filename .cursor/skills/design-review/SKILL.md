---
name: design-review
description: Reviews layout density, theme adherence, typography, spacing, and visual consistency. Use during visual layout or CSS adjustments.
---

# Design Review Skill

Use this skill when auditing UI styling, colors, layout structures, and spacing rules.

## Review Checklist

### 1. Style & Spacing Consistency
- **Design System Tokens:** Ensure custom components utilize predefined design variables (colors, borders, shadows, font sizes) rather than ad-hoc inline styles.
- **Layout Spacing:** Check for consistent paddings, margins, grid gaps, and alignment.

### 2. Clinical Theme Adherence
- **Layout Density:** Review components to confirm the visual target is dense, clean, calm, and fast to scan rather than overly flashy or visually expressive.
- **Browser QA / Screenshot Verification:** For major UI changes, run a local dev server with `npm run ensure` and capture screenshots to verify cross-device visual fidelity.
