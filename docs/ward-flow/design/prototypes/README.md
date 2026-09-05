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

**Three later files, added 2026-09-05. They are an addition to this folder, not a change to it.**

| File                        | What it is                                                                   |
| --------------------------- | ---------------------------------------------------------------------------- |
| `mockup-ward-home-v4.html`  | 🔴 **Ward home — THE SPEC.** Locked in by the owner on 2026-09-05            |
| `mockup-ward-home-v3.html`  | Ward home as approved earlier the same night. **Superseded — build from v4** |
| `mockup-ward-board-v3.html` | The ward bed board, same design. Still the spec for the board                |
| `design-language.html`      | The style block all three share, held once so they cannot drift apart        |

⚠️ **v3 IS KEPT AND IS NOT THE SPEC, AND THE DIFFERENCE MATTERS.** v3 tells a clinician that the
ready figure is _"always one you can fill this minute"_, and one of its three ready beds is bed 17,
already pulled for WF-355 — which the bed board, locked the same night, calls **taken, not free**.
v4 exists partly to correct that. Anyone building from v3 would build the false sentence.

Both v3 files were re-cut on 2026-09-05 when the print fix was hoisted into the shared block, so
their style blocks moved; nothing else in them changed.

⚠️ **These two screens do not follow `DESIGN-LANGUAGE.md`'s instruction to copy `community-home.html`'s
style block, and that is deliberate and owner-approved for these two screens only.** Whether the
newer block replaces the first edition anywhere else is an open question with the owner and is not
settled here. `DESIGN-LANGUAGE.md` is unchanged and still governs; every rule in it that is about
clinical safety rather than appearance is kept in full by the newer block.

The build plan for these two screens is
[`docs/superpowers/plans/2026-09-05-ward-screens-second-edition.md`](../../../superpowers/plans/2026-09-05-ward-screens-second-edition.md).

## The shared block, measured rather than reported

⚠️ **THERE ARE NOW TWO BLOCKS, AND EVERY FIGURE BELOW NAMES WHICH ONE IT IS ABOUT.** The first
edition is `community-home.html`'s block, carried by ten files. The second edition is
`design-language.html`'s block, carried by four. They are unrelated bodies of CSS and a figure that
does not say which one it counted is unusable.

**Re-derived 2026-09-05. The command is here so the next reader re-runs it instead of believing it:**

Run it from this directory. **`PYTHONIOENCODING=utf-8` is not optional** — the block is full of
box-drawing characters, Python on this machine defaults to cp1252, and it dies on them mid-print.
That is the same trap that once left a mutant on disk in `scripts/ward-flow/mutation-run.mjs`.

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import pathlib, hashlib
def block(name):
    h = pathlib.Path(name).read_text(encoding="utf-8")
    o = h.index("<style>") + len("<style>")
    return h[o : h.index("</style>", o)]
def common(a, b):
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return i
files = sorted(p.name for p in pathlib.Path(".").glob("*.html"))
# The shared block is the longest prefix its CARRIERS agree on — not any one
# file's whole style block, because the source appends its own rules too. The
# floor is what keeps a file that never adopted the block from dragging the
# shared length to nearly zero and indicting everybody else.
FLOOR = 1000
for source in ("community-home.html", "design-language.html"):
    base = block(source)
    carriers = [f for f in files if common(block(f), base) >= FLOOR]
    shared = base[: min(common(block(f), base) for f in carriers)]
    print(f"{source}: shared block {len(shared)} chars, "
          f"sha256[:12] {hashlib.sha256(shared.encode()).hexdigest()[:12]}, "
          f"carried by {len(carriers)}: {carriers}")
    print(f"  excluded (shared < {FLOOR}): {[f for f in files if f not in carriers]}")
PY
```

On 2026-09-05 it printed four lines — one result and one exclusion line per edition. The two result
lines are below with their file lists trimmed to a count; every figure in this section is copied
from that output rather than typed, and the trimmed lists are the ones spelled out in the bullets:

```
community-home.html: shared block 15982 chars, sha256[:12] f96a48d87cc7, carried by 10: [...]
  excluded (shared < 1000): ['design-language.html', 'mockup-ward-board-v3.html', 'mockup-ward-entry.html', 'mockup-ward-home-v3.html', 'mockup-ward-home-v4.html']
design-language.html: shared block 37391 chars, sha256[:12] 87641f84b905, carried by 4: [...]
  excluded (shared < 1000): [the ten first-edition files, plus mockup-ward-entry.html]
```

**Read the exclusion lines, not just the counts.** `mockup-ward-entry.html` is excluded from BOTH
editions, and a reader who checks only that ten and four add up to fourteen of fifteen files will
not notice which one is missing.

- **First edition — 15,982 characters, byte-identical in ten files:** `community-home`, `mockup-ed-home`,
  `mockup-ed-hub`, `mockup-patient`, `mockup-referral`, `mockup-search`, `mockup-statistics`,
  `mockup-transport`, `mockup-ward-home`, `mockup-ward-home-v2`. All ten agree for exactly 15,982
  characters and then each appends its own rules.
- **Second edition — 37,391 characters,** `sha256[:12] = 87641f84b905`, byte-identical in four:
  `design-language.html` (the source), `mockup-ward-home-v4.html`, `mockup-ward-home-v3.html`,
  `mockup-ward-board-v3.html`. **Guarded since 2026-09-05 by
  `tests/ward-design-language-canonical.test.ts`**, which names its carriers rather than matching a
  filename pattern — the pattern the build plan proposed would have omitted v4, the file that is now
  the ward-home spec.
- ⚠️ **`mockup-ward-entry.html` carries NEITHER block.** Its style block diverges from the first
  edition at character 3 and does not contain it anywhere. It is an eleventh first-edition-era
  mockup that never adopted the shared block, and "all ten" has always meant the other ten rather
  than all of them.
- Every file-specific rule sits **after** the block it carries, behind a
  `/* ─── this screen only ─── */` marker. Three files (`mockup-referral`, `mockup-search`,
  `mockup-statistics`) have no file-specific section at all — their blocks are exactly 15,982
  characters and nothing else.
- `community-home.html`'s own section is 83 characters: the marker comment plus a single
  `.identity--end` rule.

⚠️ **THE 2026-09-04 FIGURES RECORDED HERE — 14,025 characters, `sha256[:16] = ffea7bce424f5346`, and
a 77-character own-section for `community-home` — DO NOT RECONCILE WITH THE ABOVE, AND THAT CANNOT
NOW BE RESOLVED.** Either the block grew, or the two counts sliced the file differently. Nobody
recorded the command that produced them, so there is no way to tell which, and no way to re-run the
older method to compare. They are kept as a dated record and must not be quoted as current. **This
is the whole argument for putting the command beside the number: a figure without its method cannot
be re-derived, cannot be reconciled with a later one, and quietly outlives the thing it measured.**

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
