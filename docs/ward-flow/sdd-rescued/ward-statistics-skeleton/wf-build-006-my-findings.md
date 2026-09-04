### 1.6 — `ward-statistics-derivations.test.ts` · "finds seeded movement declines, so the withheld-not-absent claim describes a real world"

`expect(decline.unitId.length).toBeGreaterThan(0)` stands in for _"every decline names a unit"_. A
non-empty string is not a unit.

**Falsifier:** rename any unit id in `ward-sites.ts` without updating the declines in
`ward-movements.ts`. The declines point at no existing ward, the argument the test exists to defend
is false, and `.length > 0` stays true. The fix shape already exists in-repo: resolve through
`unitById`.

---

### 5.3 — `ward-statistics-sections.test.ts` · "finds no module under src importing ward-statistics"

The importer scan matches only the alias/deep-path import form. `ward-statistics.ts` sits in a
directory whose modules import each other **relatively** — confirmed live style at
`ward-nav-icons.ts:27`, `ward-sidebar-content.tsx:8`, `ward-management-navigation.tsx:12`. A relative
import matches neither probe string. There is also **no positive control**, so an absence is
indistinguishable from a wrong path.

**Falsifier:** add a relative import of `./ward-statistics` to any sibling in that directory and
render a ward figure. The sentence `statistics-ward-screen.tsx` puts in front of the reader — that
this function has no consumer in the app — is now false on screen, and the test that exists solely to
pin that sentence stays green.

Control run by the reader: the same probe shape against `ward-referrals` returns 5 files, so the
mechanism fires; against `ward-statistics` it returns empty, and the relative form returns empty.
Both exit 0 — real absences, not tooling failure.

### 7.7 — `ward-statistics.test.ts` · eight assertions that cannot fail because the assertion above already decided the value

Three clusters: a null check followed by two "not zero" checks; an equality followed by three "not
this other number" checks; another equality followed by two more. The comments claim a diagnostic
purpose — _"named individually so a red run says exactly which wrong clock pairing produced it"_ — but
**Vitest aborts the test at the first failed expectation**, so the equality above always fires first
and these lines can never appear in a red run.

**No falsifying change exists, which is the point:** they are decorative. The underlying properties
are genuinely covered by the equality assertions. The risk is a reader crediting the file with more
discrimination than it has.

---

### 8.3 — `ward-statistics-claims.test.ts` · a citation may witness itself

The cited source file is constrained only by existing on disk. **Nothing forbids it pointing at the
claims register itself**, where the evidence string literal lives. Verified empirically: collapsing
whitespace over the register and searching for one evidence literal yields **exactly one**
occurrence, so the citation would satisfy the exactly-once check forever. The register is not among
the registered surfaces, so no other check would notice.

**Falsifier:** delete the cited constant from production, watch the test go red naming the claim, and
"re-point" the source file at the register — **which the failure message explicitly invites.** The
claim now rests on nothing and the register reports green. The missing guard is a rule that evidence
must not live in the citation's own file.

### 9.7 — `ward-community-hub.test.ts` · three assertions where production computes the expectation

The page list is built by mapping the option list; the test compares the mapped names to the option
list. The id check compares a slug to the slug that built it. The destination label check resolves
through the same map it compares against.

**Falsifier:** have the option builder start discarding clinic spellings seen only once, or cap at
twenty. Both sides move together; **the hub silently loses most of its ~65 pages**; green — the only
floor is "greater than one".

### 13.3 — `ward-community-index.test.ts` · a pin that does not test its subject

The comment claims that if the field is removed from the model, the import stops resolving. **Verified
false** — the state list and the field are independent exports.

**Falsifier:** delete the field and its presence entry. The list still exports, the test is green,
**and the hub keeps rendering a sentence the same file pins as required.** The pin outlives its
subject, which is the one thing its title promises it cannot do.

### 13.4 — `ward-community-index.test.ts` · the declared size hole is confirmed open

The header delegates the size pin to a sibling. **Verified: that sibling's only size assertion is
"greater than one."** No exact-size pin exists anywhere.

**Falsifier:** filter the team-page derivation, taking ~65 teams to 3. Every assertion green on both
sides, **and 62 teams silently lose their way in.**
