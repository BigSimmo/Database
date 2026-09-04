# Ward Flow "Board" prototypes — the approved design reference

These ten HTML files are the design the owner approved on 2026-09-04. They are **reference, not
routes**: nothing imports them, they are not under `src/app/`, and they are not registered in
`docs/site-map.md` or the mockup index. They exist so the build plan has something durable to be
built against.

**They are committed because they were not.** For most of their life they lived in a session-specific
temp directory — the one place work in this project genuinely cannot survive. Ten screens, four
independent builders, and a full review pass were sitting somewhere a cleanup would have taken them.

## What is here

| File                     | Screen                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `community-home.html`    | Community hub — the coordinator all-teams view and a single team's hub |
| `mockup-referral.html`   | Refer a patient — the four-step form with the eligibility panel        |
| `mockup-patient.html`    | Patient record                                                         |
| `mockup-search.html`     | Search                                                                 |
| `mockup-transport.html`  | Transport                                                              |
| `mockup-statistics.html` | Statistics                                                             |
| `mockup-ward-home.html`  | Ward home — the questions-to-answer page with the "go to ward" control |
| `mockup-ward-entry.html` | Ward entry                                                             |
| `mockup-ed-home.html`    | ED home — the universal view of all emergency departments              |
| `mockup-ed-hub.html`     | A single ED hub                                                        |
| `DESIGN-LANGUAGE.md`     | The written language these ten implement                               |

## The shared block, measured rather than reported

Measured 2026-09-04 on the committed copies:

- **The design-language block is 14,025 characters, byte-identical in all ten files.**
  `sha256(shared)[:16] = ffea7bce424f5346`
- Every file-specific rule sits **after** that block, behind a `/* ─── this screen only ─── */`
  marker. Three files (`mockup-referral`, `mockup-search`, `mockup-statistics`) have no
  file-specific section at all.
- Own-section sizes: community-home 77, transport 2,311, ed-hub 3,937, patient 4,022, ed-home
  4,261, ward-home 4,803, ward-entry 5,120.

⚠️ **Two measurement mistakes are recorded here because both nearly stood.**

1. **A builder reported the block as 14,032 characters. It is 14,025.** The difference is harmless,
   but the figure was relayed and re-used without anyone re-deriving it, which is how a number
   arrives already believed.
2. **The first version of the check used `community-home.html` as the baseline and reported a
   MISMATCH.** That file legitimately carries a 77-character screen-specific section, so it was the
   wrong baseline — the files were fine. **The block is now defined as the longest prefix all ten
   agree on, with a floor, so no single file can be wrong in a way that indicts the other nine.**

The wider lesson, which cost more than either of these: a byte-identity check on
`mockup-statistics.html` used a `.bak` of that same file as its baseline. The violation was already
inside the backup, so the check reported IDENTICAL twice while the file was in breach. **A baseline
taken from the thing under test vouches for whatever is already wrong with it.**

## What these files are NOT

- **Not a target for further editing.** The seven-task foundation plan
  (`docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md`) supersedes them. Fixes belong
  in the real components from here on; editing a prototype now creates a second source of truth.
- **Not accessibility- or privacy-clean as shipped.** They load Geist substitutes from Google Fonts;
  the real app self-hosts its faces deliberately, and the build plan forbids adding a third-party
  font request. Do not copy the `<link>` tags into anything under `src/`.
- **Not clinically approved.** The patient record shows Aboriginal or Torres Strait Islander status
  and interpreter needs. Their **placement** has been reviewed so neither sits adjacent to the other
  or directly above the psychiatric history panel. **Whether they belong on that screen at all is a
  cultural-safety judgement that remains open with the Aboriginal health review** — the layout fix
  did not settle it and must not be cited as if it had.
- **Not populated with real patient data.** Every name, referral ID and figure is invented. The
  suburbs, clinic names, hospital sites and bed counts are drawn from the repository's own WA
  reference data.
