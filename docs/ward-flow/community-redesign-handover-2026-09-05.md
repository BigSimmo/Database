# Community redesign — handover, 2026-09-05

Ward Builder Three. Written to a file rather than left in a chat, because a finding that lives only
in a conversation dies with it.

---

## 1. State, measured at the moment of writing

```
branch  claude/ward-builder-three
tip     7802f750d9d26bbde51e5d7da91f16dbbc2ef574
master  68821fc557423e2c4b4831ccf12003951df49e9c
merged  NO — one commit unfolded: 7802f750d
status  1 line — "?? .entry21.tmp", which is not mine and predates this session
```

⚠️ **`7802f750d` was reported to me as folded and is not.** `git merge-base --is-ancestor` says the
tip is not an ancestor of master. It is the pre-registration warning described in §4 — the one
commit whose whole purpose is to be read _before_ a failure arrives, so it is the worst one to
lose. Verify by object, not by a report, before assuming otherwise.

---

## 2. What was built

Two screens, from prototypes the owner approved before any code:
`docs/ward-flow/design/prototypes/mockup-community-gateway-v1.html` and
`mockup-community-team-hub-v1.html`. **Both prototypes carry a superseded banner**: they compute
their own name-collision rule in page JavaScript, and the build uses `communityNameCollisions()`,
which groups a different set. Read them for the design and never for the rule.

- **The gateway** (`community-index.tsx`) — replaced 65 identical boxes in an alphabetical grid
  with live search, an A–Z rail, letter-headed rows, a reads-alike marker and a family panel.
- **The hub** (`community-screen.tsx`) — now opens on the team's own unanswered queue, then
  "admitted while already with this team", then the existing lists.

**Accept/decline on the hub is deliberately not wired.** `ward-flow-reducer.ts`'s role gate does not
let a community team answer its own destination — only ward, ED and coordinator can. The queue is
built and the gap is stated on the page. **Open owner question: may a community team accept or
decline a referral addressed to it?**

---

## 3. What goes RED BY DESIGN when the team data is replaced

The owner is replacing the community team list wholesale. Four guards fire; all four are
pre-registered at the top of `tests/ward-community-ratified-aliases.test.ts` (`cf2da76e1`), and two
are mine in substance:

- **`tests/ward-community-collision-coverage.test.ts`** — every assertion pins a NAMED PAIR out of
  the current list. The warning is written at the top of that file, which is the point: a handover
  is read by whoever is handed it; a comment on a red test is read by the person who has just been
  made to open it.
- **`RECORDED_COLLISIONS`** in `ward-community-vocabulary.test.ts` — currently 10 families / 24
  names.

⚠️ **Re-derive both BY HAND. Never paste `communityNameCollisions()`'s output in as the expected
value.** That recreates the exact tautology they exist to replace: a baseline taken from the subject
cannot disagree with it, so the test passes for any predicate, including a broken one.

⚠️ **And do not delete the collision-coverage file as redundant with the team-page guard, which is
the obvious tidy-up.** Measured by Ward Builder One on their own guard: truncating
`communityNameCollisions()` to five families drops five real ones — `Midland`/`Midalnd` among them —
and every assertion in their biconditional stays **green**. It proves the page agrees with the
predicate and nothing about whether the predicate is right. **Both real bugs found on 2026-09-05
came from a second implementation disagreeing with the first, name by name.** Two agreeing counts
would have found neither.

**When the new data lands:** run an independent implementation over it and take the symmetric
difference **BY NAME**, never the counts.

---

## 4. Screens looked at since the white ground landed — the fraction, not the verdict

**19 of about 30 routes**, probed live at 1400px for panel-shaped white blocks with no border and no
shadow. **Zero found.**

```
referrals · queue · handover · capacity · escalation · movements · network · out-of-area
transport · exceptions · governance · morning · statistics/overview · statistics/compare
board/rph-adult-secure · ed/peel-ed · search · community · community/inner-city-clinic
(home, discharges and statistics additionally read by eye)
```

⚠️ **Nineteen empty results in a row is the shape of a check that cannot fail, so it was broken
once before being believed**: injecting a white, edgeless, panel-sized block into a live page was
detected and named, and removing it returned the clean result. Each page also reported how many
candidates it examined — 40 on the morning board, 21 on the ED — so a page where the probe did
nothing would have been visible as zero rather than as clean.

**NOT covered, and stated as a number rather than a caveat:**

- **Desktop width only.** A panel that loses its border at a narrow width would not show here.
- **About five detail routes** needing a specific patient, movement or unit id were not visited.
  They are built from the same panel component that passed everywhere else — which is a reason to
  expect they are fine, not evidence that they are.

⚠️ A static CSS scan preceded this and **would have misled on its own**: of 210 rules painting a
ward surface, 18 declared no edge, but most were `:hover` states inheriting from their base rule,
and a rule can take its border through `composes:`. All 18 were treated as candidates to confirm in
a browser; none survived.

---

## 5. Two defects that were green in every suite and found by opening the page

Both were live on folded code.

- **Albany was on the gateway and could not be clicked.** The letter headings were sticky at
  `top: 6rem`; `main` is the scroll container, so that offset pinned the FIRST group's heading 39px
  below its own section — inside the list, over Albany's row. `elementFromPoint` at the centre of
  that row returned the `<h3>`. Fixed by making the headings **static** rather than by patching the
  offset: patching would have left a component whose correctness depended on a number matching a
  container's padding.
- **At 390px, `Armadale (Mead Centre)` rendered as a one-character-wide column of letters.**
  `.readsAlike` is `flex: none` — correctly, so its sentence is never truncated into a
  half-warning — which left the name two characters of width, and `overflow-wrap: anywhere` broke it
  between every letter. **Two correct decisions producing a broken screen.**

**Neither is findable from jsdom.** `getAllByTestId` returns 65 links whether or not something is
painted on top of them, and there is no geometry to notice with.

---

## 6. A clinical property that was never guarded, and three red tests that concealed it

The gateway's own recorded constraint is _"a way in, not a caseload — no counts of people, no
discharges and nothing about who a team is following up."_ Rendering a fabricated
`7 patients currently open` on all 65 rows:

```
INSIDE the team's link   3 assertions red — and NOT ONE about caseloads. They read the team
                         name from the link's textContent, so the injected words corrupted the
                         NAME and were reported as collision-marker errors.
OUTSIDE the link         69 tests across SIX files passed. The mutant survived.
```

**The only thing between that page and a fabricated caseload figure was where the text happened to
be nested — and the first run's three reds look exactly like coverage.** Two guards now assert over
the whole row: strip the marker's own text and what remains must be the team's name; and no digit on
a row outside that marker.

---

## 7. Colour and surface work

- **`--ward-ground` was `--surface-inset` (#f4f7fa) and is now `--surface`.** The design system's
  own SPEC §4.3: _"True-white page, cards and panels. Two non-white surfaces only — `--surface-subtle`
  (table headers, zebra) and `--surface-inset` (wells, inputs)."_ The ward layer was using the
  inset colour as a page background. Ward Lead measured the retired tint at **1.08:1 against a white
  panel** — it was never doing the separating its own comment claimed.
- **Panels take `--border` + `--e1`,** per SPEC §4.7 _"in-flow cards use border + shadow"_. They had
  `--ward-border` at 4.97:1 and no shadow — four times PsychSift's own card edge. ⚠️ **The heavy
  line was not a mistake; it was the only thing separating the panel, because the ward layer had
  adopted half the pattern.**
- ⚠️ **`--ward-border` is deliberately untouched** and still paints every rule INSIDE a panel. Its
  own comment records `--neutral-400` failing a 2:1 floor on three of four surfaces in dark mode. A
  shadow separates a card from the page and does nothing for a divider between two rows, **so
  lightening it too would have reversed a measured accessibility result to make the diff look
  internally consistent.**

---

## 8. Errors made here, recorded because the pattern repeated

- **77 vs 71.** I published "77 distinct team names, seven merges" as measured. It was 71 and six: I
  counted **distinct values of a column**, and six of those are not clinic names — one empty, five
  naming _two_ clinics with a slash. **Not arithmetic — the wrong unit.** Every count disagreement
  on this project had that cause.
- **9 suburbs vs 1.** I invented "9 suburbs name this clinic" and declared it invented. One does —
  Noranda. The real figure was _stronger_ for the argument the page was making.
- **64rem.** Ward Lead and I argued for two messages about whether it was off-scale. It is pinned
  three times already in the ward allowlist. **I read the app scale; they read my report; neither of
  us opened the allowlist.**
- **A fix that broke a case it was not about.** Adding "clinic"/"centre" to the stripped service
  words shortened the Mead keys below a length gate, and the misspelling the feature exists to catch
  fell out of its own group. **13 groups before, 13 after** — only re-reading the names showed it.

---

## 9. Open, not done

1. **May a community team accept or decline a referral addressed to it?** Owner's. The hub shows a
   queue it cannot action, and says so.
2. **Does a bracketed qualifier make two teams different?** `Alma Street (Fremantle)` vs
   `(Melville)`. Worth ten names, isolated and clean, with no other difference confounding it.
3. **The ICC copy obligation is SUPERSEDED, not done** — the team data is being replaced. The
   prototype was corrected anyway, which costs nothing and leaves it honest meanwhile.
