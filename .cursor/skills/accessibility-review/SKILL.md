---
name: accessibility-review
description: Reviews keyboard navigation support, semantic HTML tags, drawer/dialog behaviors, focus management, and screen-reader standards. Use during UI audits.
---

# Accessibility Review Skill

Use this skill when reviewing user interfaces to ensure compliance with a11y standards.

## Review Checklist

### 1. Keyboard & Focus Control

- **Interactive Elements:** Verify all button-like and link-like components use semantic HTML elements (`<button>`, `<a>`) rather than `div` tags with onClick handlers.
- **Focus Trapping:** Ensure modal dialogs, side drawers, and search overlays trap keyboard focus properly and support `Esc` key cancellation.

### 2. ARIA & Reader Markup

- **Labels:** Verify that icon-only buttons, custom inputs, and dynamic charts include appropriate `aria-label` or screen-reader descriptions.
- **Table Structure:** Ensure data tables (like document table facts) use correct semantic tags (`<thead>`, `<tbody>`, `<th>`) for readable text-to-speech rendering.
