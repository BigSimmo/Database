# Ward Flow third edition: handover

Written 8 September 2026 so that another chat can pick this work up without the original session.
Everything a builder needs is in git on the branch `claude/review-four-mockups-0l9x8c` (pull request
#2738). The scratch directory of the original session is not needed and may be gone.

## 1. What this work is

Two bodies of work were merged into a **third edition** of the Ward Flow Command mockup and the Ward
Flow design system:

- **Source L, the Live edition** (branch `claude/hospital-mockup-premium-qzq6cx`, PR #2737): the
  Command page's content, behaviour, engine, data, layout and rigour. Masthead figures, route words,
  a one bar stepper, fills only on eligible or recorded wards, a grouped rail with derived counts and
  a reconciliation line, a Light Dark Auto appearance control, a 10.5 px floor on a seven step scale,
  and the second edition design standard.
- **Source P, Platinum Raised Cool** (the owner's chosen identity from the direction studies): cool
  platinum neutrals with a fall of light, a deep slate accent, brass as a bar and never a fill, teal
  and plum for the health services, Source Serif 4, Source Sans 3 and JetBrains Mono, alpha
  hairlines, one elevation step, toned header strips with an inner radius.

The rule of the merge, from `MERGE-BRIEF.md` in this folder: Source L's content and behaviour,
Source P's identity and material, and where the two disagree the stricter rule wins and is written
down.

After the merge the owner supplied a **universal header and a rail** (open at 236 px, closed to a
76 px strip) and a **build sheet** that specifies them. The owner asked for them to be reviewed,
restyled to the third edition, improved, built into the Command mockup and carried into the design
system. That part is mapped and partly built but **not yet grafted in**. Section 5 says exactly where
it stands.

## 2. Where everything is

Repository (this branch):

| Path                                                              | What it is                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/ward-flow/mockups/command-third-edition.html`               | The Command mockup, third edition, light and dark. Real engine, real data, `window.__commandCheck`.  |
| `docs/ward-flow/mockups/design-system-third-edition.html`         | The design system page: ten rules, tokens, contrast pairs recomputed on load, 19 live components.    |
| `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`               | The same standard as a document.                                                                     |
| `docs/ward-flow/mockups/third-edition-kit/MERGE-BRIEF.md`         | The merge specification. Its tokens are the third edition tokens.                                    |
| `docs/ward-flow/mockups/third-edition-kit/check.mjs`              | The verification harness (see section 6).                                                            |
| `docs/ward-flow/mockups/third-edition-kit/shots.mjs`              | Screenshots in both themes at 1x and 2x plus a light and dark pair.                                  |
| `docs/ward-flow/mockups/third-edition-kit/inputs/rail.html`       | The owner's rail artifact, as published (second edition identity).                                   |
| `docs/ward-flow/mockups/third-edition-kit/inputs/buildsheet.html` | The owner's build sheet, as published.                                                               |
| `docs/ward-flow/mockups/third-edition-kit/inputs/SHELL-SPEC.md`   | Every rule of the build sheet extracted and numbered, with its conflicts against the brief.          |
| `docs/ward-flow/mockups/third-edition-kit/inputs/RAIL-MAP.md`     | The rail artifact mapped line by line, the engine diff, and the integration plan (read part d, e).   |
| `docs/ward-flow/mockups/third-edition-kit/inputs/SHELL-REVIEW.md` | Not written. The review agent was cut off. Do it first (section 5, step 1).                          |
| `docs/ward-flow/mockups/third-edition-kit/shell/`                 | Only `shell.css`, a first draft of the restyled shell rules, unverified. No markup, script or notes. |
| `docs/ward-flow/mockups/third-edition-kit/REVIEW-FINDINGS.json`   | The 82 findings from the five reviewers of the third edition mockup and design system.               |
| `docs/ward-flow/mockups/third-edition-kit/check-output.txt`       | The harness output on the mockup at wind down.                                                       |

Published pages (claude.ai artifacts, private to the owner):

- The owner's rail: https://claude.ai/code/artifact/ac61a6dc-f85e-40ed-b62c-947fd097e114
- The owner's build sheet: https://claude.ai/code/artifact/cc1e6654-37ad-4e18-a501-7b88c5caad5a
- The Live edition Command: https://claude.ai/code/artifact/60c8bd59-7392-499d-bfe5-eee90131e1da
- The second edition standard: https://claude.ai/code/artifact/352faeba-eb50-4cb1-934b-a0dd7b36d642
- Platinum Raised Cool (first edition Command): https://claude.ai/code/artifact/4da67918
- The third edition Command and design system were not republished after the fix pass was cut off.
  Publish from the files above once the harness is green.

## 3. What is done

- The third edition Command mockup is built and passes the harness in both themes: fonts, no page
  errors, `window.__commandCheck` empty, no sideways overflow at 1920, 1440, 1280, 1200 and 390,
  contrast on every visible text element, the type floor, the diagram at least 260 px tall at 1440 by
  900, the appearance control's first click from a dark machine, and a visible keyboard focus ring.
- It was reviewed by five independent reviewers (rule compliance, accessibility, feature fidelity,
  standard completeness, visual quality): 82 findings, 63 of them high or medium, saved in
  `REVIEW-FINDINGS.json` in this folder. A fix pass was started and was cut off part way by the
  session's usage limit. The mockup on this branch carries the fixes applied up to that point; run
  `git diff 4b96c56 -- docs/ward-flow/mockups/command-third-edition.html` to see exactly which. The
  harness output at wind down is in `check-output.txt`. Treat every finding as open until re-checked.
- The design system page and document are built on the same stylesheet. The page counts its own
  figures on load and recomputes every contrast pair from the live tokens; its rail line must read
  "Figures reconcile" in both themes.
- The owner's header and rail have been read in full (SHELL-SPEC.md, RAIL-MAP.md). The design
  review (SHELL-REVIEW.md) was cut off before it wrote anything and must be redone. The restyle
  produced only a first draft of `shell/shell.css`, unverified; the markup, script, preview and notes
  were never written.

## 4. Decisions already taken (the owner may reverse any of them)

1. Identity from Source P, behaviour from Source L. The stricter rule wins on conflicts.
2. The `--gilt` token name is kept and the colour is called brass in prose. Brass is a bar, never a
   fill behind text.
3. The prototype chip stays neutral, as the Live edition has it.
4. WACHS gets rust (`#8C5A3C` light, `#D89A78` dark). East is slate, North plum, South teal.
5. The appearance control is the Live edition's Light Dark Auto, remembered per browser.
6. Radii 10 outer, 9 inner, 6 controls. Gap 14. Seven step scale, 10.5 px floor, nothing between
   steps.
7. `--svc-south` in light was 4.04:1 on the ground; it was darkened to reach 4.5:1 wherever a
   service name sits on the canvas. Check the token block for the final value.

## 5. What is not done, and how to do it

The header and rail are not yet in the Command mockup. `RAIL-MAP.md` part e compares two build paths
and recommends **path A: graft the shell into `command-third-edition.html`**, because the engine and
the Command body exist only there, the forty stylesheet fixes live there, and the harness targets its
ids. Do not start from `rail.html`: its Command body is a 22 line stand in with its own invented data,
not the engine.

Order of work:

1. Read `MERGE-BRIEF.md`, then `RAIL-MAP.md` parts d and e, then `SHELL-SPEC.md` (its last
   section lists the conflicts). Then finish the fix pass: work through `REVIEW-FINDINGS.json`
   (high and medium first), reproduce each before fixing, keep the engine's logic and ids intact,
   and run the harness until ALL GREEN. Then write the design review of the header and rail
   (keep, change, improve, against the brief and the ten rules) and restyle the shell: its CSS
   (lines 2201 to 4601 of `inputs/rail.html`), markup (4914 to 5078) and script sections (5079 to
   6559, minus the every screen section), every colour through the tokens, sizes on the scale,
   brass never a fill, focus rings everywhere.
2. Settle the owner decisions in section 8 first. The largest one (one row bar versus the masthead
   figures strip) changes the header markup.
3. Graft: append `shell/shell.css` after the third edition rules, replace `header.topbar` with the
   header from `shell/shell-markup.html`, replace the static `nav.rail` and its `railFoot` with the
   shell's single `nav.rail`, add `shell/shell-script.js` after the engine, and re-point every shell
   read of data at the engine (RAIL-MAP.md d.8: the engine's `MOVEMENTS`, `UNITS`, `EDS`,
   `REFERRALS`, `isBreached`, `isOpen`, `figures`, `reconcile` are the single source of truth; the
   shell's own `MOVES`, `BEDS`, `WARDS` go). Keep the skip link at `#qpane-patients`. Keep one
   `window.__commandCheck`, the engine's.
4. Drive the rail's open and closed state as RAIL-MAP.md d.6 says: one nav, `data-rail` on the root
   set before first paint, the rail's own button and the `[` key, remembered under `ward-flow-rail`,
   no demo switcher, no number keys.
5. Merge the width ladder (RAIL-MAP.md d.7) and re-derive the locked layout's height from the 56 px
   bar. Re-verify the diagram at 1440 by 900.
6. Run the harness until ALL GREEN in both themes, then the eight verifications in RAIL-MAP.md
   "What the builder must verify either way".
7. Design system: rewrite 5.6 and 6.2 for the bar and the drawers, extend 6.1 with the closed strip,
   the hover card, the tone dot rule, the service stripe and the bracket key, add the screens index,
   and carry "What was added, and why" and "Considered, not built" from the rail artifact into
   Departures and Decisions. Copy the mockup's final `<style>` into the page and recompute the
   contrast rows with `recompute-contrast.mjs` if present, else by the same WCAG formula.
8. One review and fix pass on the result, then the harness again.
9. Repository handoff: `npx prettier --write` on the changed files, `npm run snapshot:repo-awareness`,
   `npm run verify:pr-local -- --files <the changed files>`, commit, push, update the PR #2738 body's
   Verification section with the real output, and record the review with `npm run ledger:append`.
10. Publish the two pages as artifacts and send light and dark screenshots.

## 6. The harness

From a directory that has `node_modules` with Playwright and Chromium at
`/opt/pw-browsers/chromium`:

```
node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/command-third-edition.html platinum
node docs/ward-flow/mockups/third-edition-kit/shots.mjs docs/ward-flow/mockups/command-third-edition.html out/command platinum
```

The scripts route Google Fonts to a local `fonts/` directory when one exists beside them. Without it
they need network access to `fonts.googleapis.com`; if the sandbox has none, download the latin
woff2 files for Source Serif 4 (600, 700), Source Sans 3 (400 to 700) and JetBrains Mono (400 to 600) into `fonts/` with the CSS saved as `fonts/platinum.css`. A claim that a build passes is only a
pass with the harness output pasted.

## 7. Fix pass report

The fix agent did not return. Its partial work is on the branch (diff against commit 4b96c56). The
findings are in `REVIEW-FINDINGS.json`. Treat each as open until reproduced and fixed, and re-run the
harness before trusting the build. CI on PR #2738 was not re-checked after the last push.

## 8. Decisions the owner must make before the graft

1. **One row bar or the masthead figures strip.** The merge brief keeps the Live edition's masthead
   figures; the build sheet removes them into the Activity drawer's live tally and puts one primary
   action on the row (SHELL-SPEC.md conflict C.15). Recommendation: the sheet wins on the shell, and
   the date and time go back somewhere always visible (the rail's shift eyebrow already shows the
   time).
2. **What the Service selector scopes.** The engine has no service scope. Either it scopes the
   queue, the pressure strip and the diagram (real work) or only what the shell renders, in which
   case "filters this page" must be reworded (RAIL-MAP.md d.4 item 9). Honest minimum: filter the
   queue and the strip and say the diagram shows the whole network.
3. **The brand stripe over the bar.** The third edition paints a 3 px brand stripe at the top of the
   window; the bar is sticky at the top with a higher z-index and would cover it (SHELL-SPEC.md C.9).
   Either the stripe rises above the bar and the drawers with pointer events off, or the bar reserves
   its top 3 px.
4. Whether the closed strip may widen past 76 px if "Governance" does not fit at 10.5 px (C.4). Words
   never shrink.

## 9. Prompt to paste into the next chat

> Continue the Ward Flow third edition. Read
> `docs/ward-flow/mockups/third-edition-kit/HANDOVER.md` on branch
> `claude/review-four-mockups-0l9x8c` (PR #2738) and do section 5 in order, after settling the
> section 8 decisions with me. Every build must pass the harness in section 6 in both themes, with
> the output pasted. Publish the finished Command mockup and design system as artifacts and send
> light and dark screenshots. Keep commits small and push after each finished step.
