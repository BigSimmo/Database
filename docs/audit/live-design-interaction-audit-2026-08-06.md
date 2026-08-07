# Live design & interaction audit — master report

**Date:** 2026-08-06  
**App:** Clinical KB · Guest · **live** (not demo)  
**Base URL:** `http://localhost:4298`  
**Project ID:** `clinical-kb:5b6a50f62d5b`  
**Commit:** `f1c8b582544ec57c64c98fced8a26ae29b94a43a`  
**Method:** Playwright Chromium viewport emulation (phone / tablet / desktop) against the running local app from `npm run ensure`  
**Scope:** Direct-use behaviour + live visual quality. Documents counted as **one page type** (home + Browse library / Sources folded in).  
**Out of scope:** Physical Safari / installed PWA, live RAG ranking quality, signed-in-only deep paths, mockups, autofix.

## Evidence locations

| Artifact              | Path                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| Phone JSON            | `%TEMP%\ux-sweep-evidence\audit-phone-390.json`                                      |
| Tablet JSON           | `%TEMP%\ux-sweep-evidence\audit-tablet-768.json`                                     |
| Desktop JSON          | `%TEMP%\ux-sweep-evidence\audit-desktop-1440.json`                                   |
| Screenshots           | `%TEMP%\ux-sweep-evidence\phone-390-*.png`, `tablet-768-*.png`, `desktop-1440-*.png` |
| Design-sweep evidence | `.local/workflow-evidence/*-design-sweep.json`                                       |

## Viewport matrix used

| Label   | Size       |
| ------- | ---------- |
| Phone   | 390 × 844  |
| Tablet  | 768 × 1024 |
| Desktop | 1440 × 900 |

---

## Implementation disposition — current-repo pass

This section records the implementation review performed against the current working tree. The audit below remains the before-state evidence; this disposition is the authoritative status for the follow-up pass.

### Implemented with regression coverage

| Finding                                     | Smallest safe change                                                                                                                                 | Regression proof                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Favourites route announced Answer           | The mode trigger now names the active route while the guest menu continues to omit the account-gated Favourites option.                              | DOM gate verifies truthful trigger + fail-closed menu.                                                           |
| Sources row collision at 768px              | Source rows stay stacked until `lg`; the action cluster aligns right only when the dialog has enough width.                                          | Browser geometry requires a readable title width, vertical action separation, and no dialog overflow.            |
| Duplicate Sources heading                   | Removed the drawer's repeated title/summary panel; the owning Sheet remains the single accessible heading and description.                           | Browser gate requires exactly one visible `Sources` label.                                                       |
| Phone Answer step clipped                   | The progress rail scrolls the current stage fully into view without animated page movement.                                                          | 390px browser geometry requires the active Draft answer step to stay inside the rail.                            |
| Tools descriptions clipped                  | Removed two-line clamps from tool descriptions and wrapping truncation from desktop quick-action supporting copy.                                    | Browser loop checks complete copy and page overflow at 320, 390, 639, 768, 1440, and 1920px.                     |
| Calculator results clipped on narrow phones | Constrained the shared results canvas and calculator header to zero-minimum grid tracks so cards and the Filters control shrink inside the viewport. | 320px and 390px browser geometry requires the canvas, PHQ-9 card, and Filters control to remain fully in-bounds. |
| Duplicate desktop/tablet New chat           | The shared header keeps the phone action but hides its wide copy when a visible sidebar owns New chat.                                               | 768px browser gate requires one visible New chat action.                                                         |
| Medication naming split                     | The sidebar now consumes the canonical app-mode label (`Medication`).                                                                                | DOM navigation contract uses the canonical singular label.                                                       |

Focused post-fix proof completed: `11 passed` in `favourites-auth-gate.dom.test.tsx`; `3 passed` in the isolated production browser run covering Answer progress, tablet Documents/Sources, and the six-width Tools loop.

### Reviewed and intentionally not changed

| Audit item                                | Disposition                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculators phone clearance               | Fresh endpoint geometry placed the final Y-BOCS tile about 97px above the visible dock; no current buried-card defect was reproduced, so the shared reserve was not enlarged. |
| Guest document preview / Answer from this | Retained as an authentication and document-access boundary; a design sweep must not weaken private-document authorization.                                                    |
| Sources row-open overlay concern          | The current row uses a normal Next Link and the shared Sheet owns pointer handling; no reproducible interception path was found.                                              |
| Tablet 2+1 mode-home grids                | The current `auto-fit` / 15rem minimum is an intentional readable-card composition. A global density change would be a product redesign, not a smallest safe fix.             |
| Truncated input placeholders and chips    | Kept where single-line controls expose the complete accessible name or tooltip; no control overflow or unavailable action was reproduced.                                     |
| Console 404s                              | Not reproduced in the fresh Favourites/Sources console pass, and the original audit did not record a failing URL. No asset path was guessed.                                  |
| Safety Plan shell                         | Retained as an intentional standalone, privacy-sensitive workflow with its own back path to Tools.                                                                            |

Physical iPhone Safari and installed-PWA acceptance remain separate from Chromium viewport evidence.

---

## 1. Executive summary

All **15 production surfaces** were exercised at phone, tablet, and desktop. **No page was fully blocked** (hard crash / unreachable). Core Answer search, mode homes, and most searches worked on a healthy server.

### Verdict

| Severity   | Count of distinct issues | Summary                                                                                                                                                                                         |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **High**   | 2                        | Favourites mode pill stuck on **Answer** (all sizes); Documents Sources list **badge / Add scope overlap** on tablet                                                                            |
| **Medium** | ~8                       | Documents Sources density / guest preview; Tools truncation; phone drafting clip; Calculators dock covering cards; duplicate New chat; Medication naming; console 404s; Safety plan shell break |
| **Low**    | Many                     | Orphan 2+1 card grids, placeholder truncation, mode pill + H1 redundancy, sparse guest empties                                                                                                  |

False “everything broken” findings during an earlier long run were caused by **local server connection loss** and are discarded.

### Highest-priority fixes (use this as the backlog)

1. **Favourites** — mode pill must show Favourites (not Answer) on phone, tablet, and desktop.
2. **Documents → Sources** — fix list-row layout so badges/text do not collide with **Add scope** (tablet); remove duplicate Sources header; harden row-open through overlay.
3. **Answer drafting (phone)** — stop progress-step overflow (`Drafting an…`).
4. **Tools** — stop truncating category / tool card descriptions at 390 / 768 / 1440.
5. **Calculators (phone)** — bottom composer must not bury calculator cards.
6. **Shell** — remove duplicate **New chat** (sidebar + header) on desktop/tablet shell pages.
7. **Medication** — align sidebar **Medications** vs pill/title **Medication**.
8. **Console 404s** — identify and remove failing asset requests.
9. **Tablet mode homes** — fix uneven 3-card → 2+1 orphan grids.
10. **Safety plan (desktop)** — decide whether tool should stay in Clinical Guide shell or keep intentional standalone chrome.

---

## 2. Master status matrix

Legend: **OK** = usable, no material issue · **ISSUE** = functional and/or clear design problem · **BLOCKED** = core task impossible (none found).

| #   | Page            | Route                | Phone 390 | Tablet 768 | Desktop 1440 |
| --- | --------------- | -------------------- | --------- | ---------- | ------------ |
| 1   | Answer          | `/?mode=answer`      | ISSUE     | ISSUE      | ISSUE        |
| 2   | Documents       | `/?mode=documents`   | ISSUE     | ISSUE      | ISSUE        |
| 3   | Services        | `/services`          | ISSUE     | ISSUE      | OK           |
| 4   | Forms           | `/forms`             | OK        | ISSUE      | OK           |
| 5   | Favourites      | `/favourites`        | ISSUE     | ISSUE      | ISSUE        |
| 6   | Differentials   | `/differentials`     | ISSUE     | ISSUE      | OK           |
| 7   | DSM             | `/dsm`               | ISSUE     | ISSUE      | OK           |
| 8   | Specifiers      | `/specifiers`        | OK        | ISSUE      | OK           |
| 9   | Formulation     | `/formulation`       | ISSUE     | ISSUE      | OK           |
| 10  | Medication      | `/?mode=prescribing` | ISSUE     | ISSUE      | ISSUE        |
| 11  | Tools           | `/tools`             | ISSUE     | ISSUE      | ISSUE        |
| 12  | Therapy compass | `/therapy-compass`   | ISSUE     | ISSUE      | OK           |
| 13  | Factsheets      | `/factsheets`        | ISSUE     | ISSUE      | OK           |
| 14  | Calculators     | `/calculators`       | ISSUE     | ISSUE      | OK           |
| 15  | Safety plan     | `/safety-plan`       | OK        | OK         | ISSUE        |

### Scoreboard by viewport

| Viewport     | OK  | ISSUE | BLOCKED |
| ------------ | --- | ----- | ------- |
| Phone 390    | 3   | 12    | 0       |
| Tablet 768   | 1   | 14    | 0       |
| Desktop 1440 | 9   | 6     | 0       |

---

## 3. Cross-cutting findings

| ID  | Issue                                        | Severity   | Phone                         | Tablet                                                    | Desktop                                                           | Notes                                                               |
| --- | -------------------------------------------- | ---------- | ----------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| X1  | Favourites mode pill shows **Answer**        | High       | Yes                           | Yes                                                       | Yes                                                               | Title correctly “Favourites command library”                        |
| X2  | Documents Sources UI density / open friction | High–Med   | Dup header, dense filters     | **Badge vs Add scope overlap**                            | Dup header; guest signed-URL preview; “Answer from this” disabled | Browse → Sources sheet is expected; DocumentViewer open path varies |
| X3  | Tools category / card copy truncated         | Medium     | line-clamp mid-sentence       | 5/6 category cards                                        | Quick-action cards                                                | Looks unfinished                                                    |
| X4  | Answer drafting progress clips               | Medium     | `Drafting an…`                | Results TRY NEXT / Review trunc                           | —                                                                 | Phone worst                                                         |
| X5  | Duplicate **New chat**                       | Medium     | —                             | Shell                                                     | Sidebar + header                                                  | Confirmed desktop; shared shell                                     |
| X6  | Uneven 3-card → 2+1 orphan grid              | Medium     | —                             | Most mode homes                                           | Mild on some                                                      | Looks broken at 768                                                 |
| X7  | Composer / chip placeholder truncation       | Medium–Low | Widespread                    | Specifiers, Formulation, Therapy, Factsheets, Calculators | Rare                                                              | Send control crowds long placeholders                               |
| X8  | Bottom dock covers content                   | Medium     | Services results, Calculators | —                                                         | —                                                                 | Cards/footers obscured                                              |
| X9  | Mode pill + H1 say the same thing            | Low        | Mild                          | Widespread                                                | Mild                                                              | Redundant chrome                                                    |
| X10 | Icon-only rail (no labels)                   | Low        | Hamburger                     | Always ~84px                                              | Often collapsed; expand shows labels                              | New-user discoverability                                            |
| X11 | Console resource **404**                     | Medium     | Answer, Medication, others    | —                                                         | Answer, Documents, Medication                                     | Non-blocking but noisy                                              |
| X12 | Medication vs Medications naming             | Medium     | —                             | —                                                         | Sidebar vs pill/title                                             | Consistency                                                         |
| X13 | Safety plan exits app shell                  | Medium     | N/A (OK tool UI)              | OK                                                        | No sidebar / mode pill                                            | Intentional vs accidental?                                          |
| X14 | Prompt chips don’t auto-submit               | Low        | —                             | —                                                         | Fill only                                                         | Affordance mismatch                                                 |

---

## 4. Page-by-page detail

Documents is **one** page type. Browse library / Sources findings are nested under Documents.

---

### 4.1 Answer — `/?mode=answer`

|                | Phone 390                                                | Tablet 768                                       | Desktop 1440                                 |
| -------------- | -------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| **Status**     | ISSUE                                                    | ISSUE                                            | ISSUE                                        |
| **Mode pill**  | Answer                                                   | MODE Answer                                      | Answer                                       |
| **Composer**   | Yes — “Ask a clinical question…”                         | Yes (hero)                                       | Yes                                          |
| **Tried**      | Submit `lithium` → drafting                              | Search `lithium` → run                           | Chip “lithium level timing” fills composer   |
| **Functional** | Works                                                    | Works (source-only answer observed)              | Chip does not auto-run                       |
| **Design**     | Progress step **“Drafting an…”** clips; sparse home; 404 | Results: TRY NEXT pills + Review banner truncate | **Duplicate New chat**; large empty hero     |
| **Evidence**   | `phone-390-answer.png`, `-lithium.png`                   | `tablet-768-answer.png`, `-search.png`           | `desktop-1440-answer.png`, `-after-chip.png` |

---

### 4.2 Documents — `/?mode=documents` _(includes Browse → Sources)_

|                    | Phone 390                                                                              | Tablet 768                                                              | Desktop 1440                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Status**         | ISSUE                                                                                  | ISSUE                                                                   | ISSUE                                                                                        |
| **Mode pill**      | Documents                                                                              | MODE Documents                                                          | Documents                                                                                    |
| **Composer**       | “Search source documents”                                                              | Yes                                                                     | Yes                                                                                          |
| **Setup banner**   | None this pass (privacy strip only); earlier intermittent “Complete the search setup…” | —                                                                       | —                                                                                            |
| **Browse library** | Opens **Sources** sheet; 150/2619 docs; not Privacy; not stuck                         | Opens Sources modal                                                     | Opens Sources → row **Zuclopenthixol** → `/documents/…`                                      |
| **Functional**     | Open to viewer not required on phone pass; sheet OK                                    | **List-row badges/text collide with Add scope** — first card unreadable | Guest signed-URL / preview gate; **Answer from this** disabled; overlay can intercept clicks |
| **Design**         | Duplicate Sources title/subtitle; dense filters; Provenance orphan                     | Uneven 3-card home grid; 3+2 filter grid; pill + title redundancy       | Duplicate Sources header; privacy link `/privacy?from=documents`                             |
| **Evidence**       | `phone-390-documents-home.png`, `-browse.png`                                          | `tablet-768-documents.png`, `-browse.png`                               | `desktop-1440-documents.png`, `-browse.png`, `-row-open.png`                                 |

---

### 4.3 Services — `/services`

|               | Phone 390                                                                                               | Tablet 768                              | Desktop 1440                |
| ------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------- |
| **Status**    | ISSUE                                                                                                   | ISSUE                                   | OK                          |
| **Mode pill** | Services                                                                                                | MODE Services                           | Services                    |
| **Tried**     | Search `crisis` → 45 matches                                                                            | Load home                               | Load home                   |
| **Issues**    | Privacy text can overlap hero while loading; eligibility “Child or adol…”; **dock covers card footers** | Uneven 2+1 cards; pill/title redundancy | Shared dup New chat only    |
| **Evidence**  | `phone-390-services.png`, `-crisis.png`                                                                 | `tablet-768-services.png`               | `desktop-1440-services.png` |

---

### 4.4 Forms — `/forms`

|               | Phone 390                                          | Tablet 768                   | Desktop 1440             |
| ------------- | -------------------------------------------------- | ---------------------------- | ------------------------ |
| **Status**    | OK                                                 | ISSUE                        | OK                       |
| **Mode pill** | Forms                                              | MODE Forms                   | Forms                    |
| **Tried**     | Search `mental` → 54 forms                         | Load home                    | Load home                |
| **Issues**    | Browse-by-type horizontal clip (acceptable scroll) | Uneven 2+1 cards; redundancy | Shared chrome only       |
| **Evidence**  | `phone-390-forms.png`, `-search.png`               | `tablet-768-forms.png`       | `desktop-1440-forms.png` |

---

### 4.5 Favourites — `/favourites` ⚠️

|                      | Phone 390                               | Tablet 768                  | Desktop 1440                            |
| -------------------- | --------------------------------------- | --------------------------- | --------------------------------------- |
| **Status**           | ISSUE                                   | ISSUE                       | ISSUE                                   |
| **Page title**       | Favourites command library              | Same                        | Same                                    |
| **Mode pill**        | **Answer**                              | **MODE Answer**             | **Answer**                              |
| **Composer**         | Bottom “Search favourites…”             | None (guest)                | None                                    |
| **Functional break** | Mode chrome wrong for route (all sizes) | Same                        | Same; Favourites not in primary sidebar |
| **Design**           | Large empty guest state; Sign-up CTA    | Empty lower viewport        | Sparse guest; Sign-up CTA               |
| **Evidence**         | `phone-390-favourites.png`              | `tablet-768-favourites.png` | `desktop-1440-favourites.png`           |

---

### 4.6 Differentials — `/differentials`

|               | Phone 390                                                 | Tablet 768                                                    | Desktop 1440                           |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| **Status**    | ISSUE                                                     | ISSUE                                                         | OK                                     |
| **Mode pill** | Differentials                                             | MODE Differentials                                            | Differentials                          |
| **Tried**     | Search `lithium`                                          | Search `lithium`                                              | Search `depression`                    |
| **Issues**    | Placeholder truncates; recent card “first episode psych…” | Home 2+1; results large gap above composer; dual “Searching…” | Snippets truncate (acceptable); usable |
| **Evidence**  | `phone-390-differentials*.png`                            | `tablet-768-differentials*.png`                               | `desktop-1440-differentials*.png`      |

---

### 4.7 DSM — `/dsm`

|               | Phone 390                                       | Tablet 768                       | Desktop 1440           |
| ------------- | ----------------------------------------------- | -------------------------------- | ---------------------- |
| **Status**    | ISSUE                                           | ISSUE                            | OK                     |
| **Mode pill** | **DSM-5 Diagnos…** (truncated)                  | MODE DSM-5 Diagnosis             | DSM-5 Diagnosis (full) |
| **Issues**    | Pill + placeholder truncate; category row clips | 2+1 cards; pill/title redundancy | Clean home             |
| **Evidence**  | `phone-390-dsm.png`                             | `tablet-768-dsm.png`             | `desktop-1440-dsm.png` |

---

### 4.8 Specifiers — `/specifiers`

|               | Phone 390                        | Tablet 768                             | Desktop 1440                  |
| ------------- | -------------------------------- | -------------------------------------- | ----------------------------- |
| **Status**    | OK                               | ISSUE                                  | OK                            |
| **Mode pill** | Specifiers                       | MODE Specifiers                        | Specifiers                    |
| **Issues**    | Clinical-start pills clip mildly | Placeholder truncates; 2+1; redundancy | Readable cards + pathway      |
| **Evidence**  | `phone-390-specifiers.png`       | `tablet-768-specifiers.png`            | `desktop-1440-specifiers.png` |

---

### 4.9 Formulation — `/formulation`

|               | Phone 390                                  | Tablet 768                   | Desktop 1440                   |
| ------------- | ------------------------------------------ | ---------------------------- | ------------------------------ |
| **Status**    | ISSUE                                      | ISSUE                        | OK                             |
| **Mode pill** | Formulation                                | MODE Formulation             | Formulation                    |
| **Issues**    | Placeholder “Describe a pattern, mecha...” | Placeholder truncates; 2+1   | Frameworks + thread clear      |
| **Evidence**  | `phone-390-formulation.png`                | `tablet-768-formulation.png` | `desktop-1440-formulation.png` |

---

### 4.10 Medication — `/?mode=prescribing`

|               | Phone 390                          | Tablet 768                                            | Desktop 1440                                         |
| ------------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **Status**    | ISSUE                              | ISSUE                                                 | ISSUE                                                |
| **Mode pill** | Medication                         | MODE Medication                                       | Medication                                           |
| **Issues**    | Checks chip **“Ac…”**; console 404 | Uneven suggestion cards (2+1); long placeholder tight | Sidebar **Medications** vs pill/title **Medication** |
| **Evidence**  | `phone-390-medication.png`         | `tablet-768-medication.png`                           | `desktop-1440-medication.png`                        |

---

### 4.11 Tools — `/tools`

|               | Phone 390                                                                       | Tablet 768                                                                      | Desktop 1440                     |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| **Status**    | ISSUE                                                                           | ISSUE                                                                           | ISSUE                            |
| **Mode pill** | Tools                                                                           | MODE Tools                                                                      | Tools                            |
| **Issues**    | `line-clamp-2` cuts Clinical KB Search / Differentials / Documents mid-sentence | Category cards: Ask evidence / Compare / Prescribe / Documents / Refer truncate | Quick-action card copy truncates |
| **Evidence**  | `phone-390-tools.png`, `-scrolled.png`                                          | `tablet-768-tools.png`                                                          | `desktop-1440-tools.png`         |

---

### 4.12 Therapy compass — `/therapy-compass`

|               | Phone 390                                                           | Tablet 768                                       | Desktop 1440                       |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| **Status**    | ISSUE                                                               | ISSUE                                            | OK                                 |
| **Mode pill** | Therapy                                                             | MODE Therapy                                     | Therapy                            |
| **Issues**    | Placeholder “Search therapies, sympto”; pill “Low mood & motivatio” | Placeholder “…or ski”; 2+1; Therapy vs full name | UI short label OK; clean otherwise |
| **Evidence**  | `phone-390-therapy-compass.png`                                     | `tablet-768-therapy-compass.png`                 | `desktop-1440-therapy-compass.png` |

---

### 4.13 Factsheets — `/factsheets`

|               | Phone 390                               | Tablet 768                                   | Desktop 1440                  |
| ------------- | --------------------------------------- | -------------------------------------------- | ----------------------------- |
| **Status**    | ISSUE                                   | ISSUE                                        | OK                            |
| **Mode pill** | Factsheets                              | MODE Factsheets                              | Factsheets                    |
| **Issues**    | Placeholder “Search a medicine, condit” | Placeholder “…thera”; topic pills 3+1 uneven | Topic chips + grid fine       |
| **Evidence**  | `phone-390-factsheets.png`              | `tablet-768-factsheets.png`                  | `desktop-1440-factsheets.png` |

---

### 4.14 Calculators — `/calculators`

|               | Phone 390                                                                                                   | Tablet 768                                          | Desktop 1440                   |
| ------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------ |
| **Status**    | ISSUE                                                                                                       | ISSUE                                               | OK                             |
| **Mode pill** | Tools (parent)                                                                                              | MODE Tools                                          | Tools (nested — intentional)   |
| **H1**        | 8 calculators                                                                                               | 8 calculators                                       | 8 calculators                  |
| **Issues**    | **Bottom composer + privacy strip cover lower cards** (MDQ nearly obscured); filter “S…”; placeholder trunc | Filter “General distr…”; AUDIT-C subtitle truncates | Clean under Tools chrome       |
| **Evidence**  | `phone-390-calculators.png`                                                                                 | `tablet-768-calculators.png`                        | `desktop-1440-calculators.png` |

---

### 4.15 Safety plan — `/safety-plan`

|               | Phone 390                              | Tablet 768                   | Desktop 1440                                                |
| ------------- | -------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| **Status**    | OK                                     | OK                           | ISSUE                                                       |
| **Mode pill** | None (tool chrome)                     | None                         | None                                                        |
| **Shell**     | Tool layout                            | No rail                      | **No Clinical Guide sidebar** — chrome break vs rest of app |
| **Tried**     | Build active; Finalise disabled at 0/6 | Load example visible         | Two-column Build / Patient copy                             |
| **Evidence**  | `phone-390-safety-plan.png`            | `tablet-768-safety-plan.png` | `desktop-1440-safety-plan.png`                              |

---

## 5. Discarded / invalid findings

Do **not** treat these as product bugs:

- Cascade of `nav-fail` / `no-composer` / empty sidebar on all modes during a mid-run **server outage** (tiny blank PNGs in early `z-*.png` set).
- First-pass automation claiming “composer missing” on tablet when search still succeeded (detector false negative).
- First-pass desktop JSON claiming “sidebar labels not visible” on every page (icon-rail collapsed vs expanded; refined desktop pass confirmed labeled sidebar when expanded).

---

## 6. Recommended fix order

| Priority | Fix                                          | Pages / sizes         | Effort hint  |
| -------- | -------------------------------------------- | --------------------- | ------------ |
| P0       | Favourites mode pill = Favourites            | All                   | Small        |
| P0       | Sources list-row layout (badge vs Add scope) | Documents @ 768       | Medium       |
| P1       | Remove duplicate Sources header              | Documents all         | Small        |
| P1       | Phone drafting progress overflow             | Answer @ 390          | Small        |
| P1       | Tools card truncation                        | Tools all             | Small–medium |
| P1       | Calculators phone dock clearance             | Calculators @ 390     | Medium       |
| P2       | Deduplicate New chat                         | Shell desktop/tablet  | Small        |
| P2       | Medications vs Medication labels             | Medication @ 1440     | Small        |
| P2       | Tablet 2+1 action-card grids                 | Many mode homes @ 768 | Medium       |
| P2       | Console 404 assets                           | Global                | Investigate  |
| P3       | Placeholder truncation / chip UX             | Many phones/tablets   | Medium       |
| P3       | Safety plan shell decision                   | Safety plan @ 1440    | Product call |

---

## 7. `/issues` capture recommendations

| Finding                                     | Capture?                            |
| ------------------------------------------- | ----------------------------------- |
| Favourites mode pill = Answer               | **Yes** — High, confirmed 3/3 sizes |
| Documents Sources badge / Add scope overlap | **Yes** — High/Med, tablet          |
| Documents Sources double header             | **Yes** — Medium                    |
| Tools truncation                            | **Yes** — Medium, 3 sizes           |
| Answer drafting clip on phone               | **Yes** — Medium                    |
| Calculators dock covering cards             | **Yes** — Medium, phone             |
| Duplicate New chat                          | Optional                            |
| Medication naming split                     | Optional                            |
| Console 404s                                | Optional chore                      |
| Safety plan shell                           | Optional (product decision)         |

No `/issues` mutations were made during this audit.

---

## 8. How to re-run

```bash
npm run ensure
# Use printed URL — do not assume :3000

# Optional planner evidence
npm run workflow:design-sweep -- --write-evidence

# Then re-audit with Playwright (or Cursor browser agents) at:
#   Phone  390×844
#   Tablet 768×1024
#   Desktop 1440×900
# against the 15 routes in §2.
```

Physical phone acceptance remains separate: [docs/audit/phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md).  
Search chrome contracts: [docs/rag-behaviour/search-chrome-behaviour.md](../rag-behaviour/search-chrome-behaviour.md).

---

## 9. Agents / passes that produced this report

| Pass                                              | Viewport | Outcome                                           |
| ------------------------------------------------- | -------- | ------------------------------------------------- |
| Phone live audit                                  | 390      | 3 OK / 12 ISSUE                                   |
| Tablet live audit                                 | 768      | 1 OK / 14 ISSUE                                   |
| Desktop live audit                                | 1440     | 9 OK / 6 ISSUE                                    |
| Earlier swarm (discarded blockers after reverify) | Mixed    | Confirmed Favourites + Documents + console themes |

---

_End of master report._
