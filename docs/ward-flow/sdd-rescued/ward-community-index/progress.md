# SDD ledger — plan: docs/superpowers/plans/ward-community-index.md

Spec: Ward Lead's WF-BUILD-002 assignment, quoted verbatim at the top of the plan. Binding
authority. The plan is its argument.

## Pre-flight scan

### Pairs sharing a file or an interface

| A      | B                           | A produces                   | B consumes                                                   | Found                                                                                                                            |
| ------ | --------------------------- | ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Task 1 | Task 2                      | the index page and its hrefs | the orphan assertion's requirement                           | **Clean, and Task 2 is diagnostic only.** Task 2 writes no code — it reads the assertion and reports what Ward Lead must change. |
| Task 1 | live statistics implementer | `community/` + a new route   | `statistics/**`                                              | **Disjoint by construction.** Constraint 3 puts the whole statistics directory out of bounds.                                    |
| Task 1 | Ward Lead's reducer agents  | none                         | `ward-flow-reducer.ts`, `ward-flow-events.ts`, `ward-nav.ts` | **Disjoint.** Constraint 2 forbids all three outright.                                                                           |

### Does each task's own text agree with itself?

| Task | Checked                                                      | Found                                                                                                                                                               |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | "copy the `/wards` shape" vs "derive the grouping"           | **Tension, ruled below.** `/wards` groups 23 wards; the community fixture may carry no comparable required key. Copying the shape cannot mean copying the grouping. |
| 1    | Constraint 5 (set equality) vs Constraint 6 (count equality) | **Agrees, and deliberately redundant.** Set equality misses a duplicate; count equality misses a substitution. Both, or neither catches its own blind spot.         |
| 1    | Constraint 7 (no invented data) vs "grouped sensibly"        | **Tension, ruled below.**                                                                                                                                           |
| 2    | its own scope                                                | **Agrees.** Diagnostic, writes nothing.                                                                                                                             |

### Against the review rubric

| Plan mandates                                       | Rubric treats as     | Found                                                                                                                                              |
| --------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constraint 4, a duplicated literal route prefix     | duplication          | **No conflict — this is a deliberate, expensive-to-relearn exception.** Ward Lead's rule; the composed form is invisible to the reachability scan. |
| Constraints 5 + 6, two assertions over one property | redundant assertions | **No conflict.** They catch different faults; the redundancy is the point.                                                                         |

## Rulings made before execution

**Ruling: group by a REQUIRED field, or do not group at all.** If the only plausible key is
optional, render one flat alphabetical list and report which field was rejected. Why: an "Other"
bucket built from an absent optional field reads to a coordinator as a real category of team, which
is invented data wearing a heading — the exact failure the statistics work has spent all day
closing. Cost if wrong: a flat list of 65 that Ward Lead asks to be grouped later; one re-render.

**Ruling: copying the `/wards` shape means its LAYOUT, ROW and TEST shape — not its grouping.**
23 wards and 65 teams are different problems and the fixtures are not the same type. Cost if wrong:
the two index pages look less alike than Ward Lead intended.

**Ruling: we do not register the route and we do not touch the orphan constant.** Ward Lead asked
to be told rather than edited around, and `ward-nav.ts` is inside its in-flight rename. Cost if
wrong: the route is briefly unregistered and one test stays red — visible, not silent.

**Ruling: the implementer may be BLOCKED FROM COMMITTING and must report rather than work around
it.** The statistics implementer holds files under `src/components/` and `tests/`, and the
pre-commit hook refuses when a staged change triggers a generator whose other inputs are dirty. No
`--no-verify`, no `git add -A`, no stash, no staging another agent's files. Cost if wrong: one
implementer idles until the other lands — which is cheaper than either alternative, both of which
this session has now seen.
