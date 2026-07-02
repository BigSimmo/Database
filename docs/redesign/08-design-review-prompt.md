# Design Review Prompt — Clinical KB (July 2026)

Two reusable prompts for reviewing design work on this product, tuned to its
context: a clinical knowledge-base used by clinicians under time pressure, built
on a tiered design-token system (primitive → semantic → component), a shared
`ui/` component layer, Next.js, and mobile bottom-sheet patterns.

- **Full review (v2)** — a rigorous, end-to-end pass for a whole screen, flow, or
  new pattern. Covers 25 dimensions plus formal heuristic and cognitive lenses.
  Use it for redesigns, new surfaces, and pre-release confidence.
- **PR-pass checklist** — a fast, ~10-point gate for a single component or small
  change in a pull request. Use it when the full review is too heavy.

Paste the relevant block to a reviewer (human or AI) alongside the mockup,
screenshot, Figma link, or running screen. For clinical/answer/source/privacy
changes, pair the review with the governance preflight in
`.github/pull_request_template.md`.

## Full review (v2)

```markdown
# Design Review Prompt (v2)

## Role
You are a senior product designer running a rigorous, end-to-end design review
of the attached screen(s)/flow/component. The product is a clinical
knowledge-base used by clinicians, often under time pressure and sometimes at
the point of care. It uses a tiered design-token system (primitive → semantic →
component), a shared `ui/` component layer, Next.js, and mobile bottom-sheet
patterns. Optimize for clinical safety, clarity, speed, and consistency —
never novelty for its own sake.

## Evaluation lenses (apply throughout)
- Nielsen's 10 heuristics: visibility of system status; match to real world;
  user control & freedom; consistency & standards; error prevention;
  recognition over recall; flexibility & efficiency; aesthetic & minimalist
  design; help users recognize/recover from errors; help & documentation.
- Cognitive principles: Gestalt grouping (proximity/similarity/closure);
  Fitts's law (target size & distance); Hick's law (limit choices);
  Miller's law (chunk information); recognition over recall; Jakob's law
  (respect platform/web conventions users already know).

## How to review
For EVERY dimension below:
1. Note briefly what works and should be preserved.
2. List problems, each as: **[Severity]** — location — why it hurts THIS user
   in THIS context — a specific, testable fix (name the token/component).
3. Mark findings **Confirmed** (visible in the artifact) vs **Needs testing**
   (requires the running app, a user, or a device to verify).
4. Write "N/A" for dimensions that don't apply, and say why.

Severity:
- **Blocker** — unsafe, broken, or blocks the core task / fails WCAG A.
- **High** — significant friction, confusion, or inconsistency; fails WCAG AA.
- **Medium** — noticeable but non-blocking; polish or consistency gap.
- **Low** — minor / subjective refinement.

## Dimensions

### A. Purpose & strategy
Who is the user, in what context, trying to do what? Is the primary task the
clearest path and the primary action the most prominent element? Anything on
screen that doesn't serve the core job?

### B. Information architecture & navigation
Grouping/labeling match the user's mental model? Always clear where you are and
where you can go? Search/filter/sort discoverable and predictable?

### C. Interaction & flow
Walk the happy path + 2–3 edge paths; find dead-ends, extra steps, ambiguity.
Are ALL states designed and distinguishable: default, hover, focus, active,
disabled, selected, loading, empty, error? Is system status always visible?
Are destructive/irreversible actions confirmed or undoable? Is perceived
latency handled (skeletons, optimistic UI)?

### D. Visual design
Layout/grid/alignment/spacing rhythm consistent? Clear visual hierarchy? Type
scale, weight, line-height, and readable line length applied consistently and
semantically? Color: semantic roles correct, never the ONLY signal? Elevation,
radius, borders, shadows, and motion consistent and purposeful?

### E. Forms & data entry
Required vs optional clearly signaled? Validation timing sensible (not
prematurely aggressive)? Errors shown inline AND summarized, phrased as fixes?
Correct input types/keyboards/masks/autofill? Sensible defaults? Long-form and
partially-complete states handled?

### F. Data-dense views & tables
Sorting/filtering/pagination/bulk-actions clear? Column priority right on small
screens? Density appropriate (and a compact/comfortable option if needed)?
Scanning supported (alignment, zebra, sticky headers)?

### G. Data visualization
Chart type fits the question? No distortion (truncated axes, misleading area)?
Colorblind-safe with redundant encoding (not color alone)? Accessible
(labels/table fallback)? Legible at target sizes?

### H. Overlays, layering & notifications
Right container for the job (inline vs popover vs sheet vs modal)? Focus trap +
restore, and clear dismissal (Esc/backdrop/close)? Toast vs banner vs modal
used correctly by urgency/persistence? Coherent z-index/stacking system?

### I. Search & autocomplete
Zero-result, suggestion, recent-search, and scoped-search states designed?
Query correction / "did you mean" / synonyms? Result relevance and provenance
legible? Latency and empty-query states handled?

### J. Content & UX writing
Labels/buttons/microcopy specific and action-oriented? Error/empty/help copy
human and actionable? Terminology consistent and clinically accurate? Scannable?

### K. Efficiency & power use
Keyboard shortcuts / command palette for frequent actions? Smart defaults and
prefill reduce work? Bulk operations where volume warrants? Repeat tasks fast?

### L. Onboarding, help & education
First-run and empty states teach the feature? Contextual help/tooltips where
concepts are non-obvious? Path to fuller docs without leaving the task?

### M. Design system & consistency
Tokens used for color/space/type/radius/elevation (no hardcoded one-offs)?
Shared `ui/` components reused, not re-invented? Matches patterns elsewhere?
Internal, platform (Jakob's law), and real-world/clinical conventions honored?

### N. Accessibility (audit explicitly — don't assume)
Text & non-text contrast meet WCAG AA? Fully keyboard-operable, logical focus
order, visible focus? Correct semantics/ARIA, labeled icon-only controls? Touch
targets ≥44px with spacing? `prefers-reduced-motion` respected? `forced-colors`
/ Windows high-contrast keeps everything visible and usable? Works at 200% zoom
/ reflow without loss?

### O. Responsive & cross-platform
Holds up at mobile/tablet/desktop? Mobile patterns (bottom sheets, safe areas,
thumb reach) correct? Touch vs pointer affordances right? Orientation/reflow OK?

### P. States & resilience
Empty, first-run, loading, error, offline, permission-denied, and timeout states
designed? Behavior at 0 / 1 / many / very-many items and with very long text
(truncation, wrap, overflow)?

### Q. Temporal & real-time
Timeouts, session expiry, and auto-save handled gracefully? Real-time updates,
staleness, and "data as of <time>" communicated? Concurrent-edit conflicts?

### R. Numeric & unit safety (clinical-critical)
Units always explicit and unambiguous (mg vs mcg vs mL)? No dangerous decimals
(no trailing zeros like "1.0"; leading zero for "<1")? Ranges, rounding, and
significant figures correct? Dosing/values impossible to misread at a glance?

### S. Trust, safety & clinical fit
Source/provenance and confidence/uncertainty communicated clearly? Any visual
emphasis that could bias a clinical decision? Privacy/data-handling legible?
Design forgiving of mistakes in a high-stakes context?

### T. Theming & dark mode
Both light and dark meet contrast? Tokens (not hardcoded colors) drive both?
Theme switching stable (no flashes, no stranded colors)?

### U. Performance & craft
Layout shift (CLS), janky interactions, heavy assets, or font-loading flashes?
Graceful degradation on poor data/network?

### V. Print & export
Printable/exported views legible and complete (no cut-off, no dark-mode ink
waste, sources retained)?

### W. Ethics & inclusion
No dark patterns (no coerced consent, forced continuity, confirm-shaming)?
Consent/permission requests honest? Inclusive language and imagery; respectful,
flexible name/identity/demographic fields?

### X. Measurement & build fidelity
Is the flow instrumented for success/error/analytics? Does the shipped
implementation match the intended design (visual-regression, redline drift,
tracked design debt)?

### Y. Brand & emotional tone
Cohesive, premium, and appropriate to a professional clinical tool — confident
and calm, not noisy or playful where stakes are high?

## Output
1. Findings grouped by dimension (A–Y), each with severity, location,
   confirmed/needs-testing, and a specific fix.
2. A ranked "fix these first" list (all Blockers, then High).
3. A "strengths to preserve" note.
4. A summary scorecard: for each dimension, a 1–5 score + one-line rationale,
   plus an overall readiness call (Ship / Ship with fixes / Needs work).
```

## PR-pass checklist (fast gate for a single component / small change)

```markdown
# Design PR-Pass — quick review

Review the changed component/screen against these. For each: PASS, or a
one-line issue + fix. Flag anything unsafe or WCAG-failing as a blocker.

1. Purpose — the primary action is obvious and prominent; nothing extraneous.
2. States — default/hover/focus/active/disabled/selected/loading/empty/error
   all present and distinct; system status is visible.
3. Tokens — color/spacing/type/radius/elevation come from tokens, no hardcoded
   one-offs; reuses shared `ui/` components instead of re-inventing.
4. Hierarchy & type — clear focal order; type scale and spacing consistent;
   readable line length.
5. Color — semantic roles correct; never the ONLY signal; AA contrast in light
   AND dark.
6. Accessibility — keyboard-operable, logical focus, visible focus ring;
   labeled icon-only controls; touch targets ≥44px; respects
   `prefers-reduced-motion` and `forced-colors`.
7. Content — labels/microcopy specific and action-oriented; error/empty copy
   actionable; terminology clinically accurate.
8. Responsive — holds at mobile/tablet/desktop; mobile sheet/safe-area/thumb
   reach correct.
9. Resilience — handles 0 / 1 / many items and very long text (truncate/wrap/
   overflow); destructive actions confirmed or undoable.
10. Clinical safety — units explicit (mg vs mcg); no dangerous decimals
    (no "1.0", leading zero for "<1"); source/provenance and any uncertainty
    legible; no emphasis that could bias a decision.

Verdict: Ship / Ship with fixes / Needs work.
```
