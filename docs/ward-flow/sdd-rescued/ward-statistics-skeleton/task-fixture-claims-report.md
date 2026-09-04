# Report — the two prose claims about the fixture

**Status:** done, green, committed.

**Commit range:** `f21ba35aa..852eb06db` (one commit, `852eb06db`). Seven files, +331 / -60.

**Tests:** `npx tsc -p tsconfig.typecheck.json --noEmit` exit 0; `npx vitest run` over the ten
discovered files — **195 ran, 194 passed, 1 expected fail** (the `it.fails` nav tripwire, untouched).
Base was 188 ran. Discovery echoed and non-empty before the run:

```
tests/ward-community-hub.dom.test.tsx tests/ward-community-hub.test.ts
tests/ward-community-index.dom.test.tsx tests/ward-community-index.test.ts
tests/ward-statistics.dom.test.tsx tests/ward-statistics.test.ts
tests/ward-statistics-claims.test.ts tests/ward-statistics-derivations.test.ts
tests/ward-statistics-sections.dom.test.tsx tests/ward-statistics-sections.test.ts
```

---

## Sentence 1 — `community-index.tsx`

The claim lived in the file's leading doc comment, in three places.

**Before**

> That dynamic route serves **sixty-five team pages** and nothing links to it from anywhere a person
> can get to. … **Sixty-five pages**, one entry condition, and that condition was knowing a URL.
>
> An index that links **all sixty-five teams** and that nothing links to leaves **all sixty-five**
> exactly as reachable as they were … strictly worse than the honest **"0 of 65"** it replaces.

**After**

> That dynamic route serves **one page per team in `COMMUNITY_TEAM_PAGES`** and nothing links to it
> from anywhere a person can get to. … **Every one of those pages** had a single entry condition, and
> that condition was knowing a URL.
>
> An index that links **every derived team** and that nothing links to leaves **every one of them**
> exactly as reachable as they were … strictly worse than the honest **"none of them are reachable"**
> it replaces.

Both paragraphs kept; only the counts came out. No count was rendered in their place — a doc comment
cannot render one, and the page's own copy states no quantity. A new ⚠️ paragraph records why the
count is absent and where the size pin belongs.

## Sentence 2 — `statistics-ed-screen.tsx`

**Before**

> `triagedAt` is optional **and most seeded referrals carry none** — and where both exist the triage
> can precede the referral, because somebody can be in a department for hours before psychiatry is
> called.

**After**

> `triagedAt` is optional, **so a referral may carry no triage instant at all** — and where both exist
> the triage can precede the referral, because somebody can be in a department for hours before
> psychiatry is called.

The replacement is a property of the TYPE, and it is already pinned:
`statistics-ed-screen/attributable/triaged-at-is-optional`, evidence `triagedAt?: Instant;`. The
paragraph, and the sentence's conclusion, are unchanged.

The same fixture assertion also sat in the source comment above that paragraph ("most seeded
referrals carry none", plus the named single fixture referral whose triage runs backwards). It was
removed there too — otherwise the register would have dropped its entry while the claim survived in
the file, which is coverage looking complete over a live gap.

---

## What was done to the register

- **Deleted** `statistics-ed-screen/attributable/most-seeded-referrals-carry-no-triaged-at`.
- **Deleted** `community-index/reachability/the-route-serves-sixty-five-team-pages`.
- **Reworded** `community-index/reachability/nothing-links-to-this-index-yet` — its claim said "the
  sixty-five pages are not yet reachable"; it now says "the team pages it lists". Leaving the count
  there would have moved the defect into the register.
- **Reworded** the reason on `statistics-ed-screen/attributable/triage-can-precede-the-referral`,
  whose tail cited the fixture example that has now gone.
- **Rewrote exclusion class 3** in the register's doc comment. It quoted both removed sentences as its
  examples. It now records that the register carries no fixture claim at all, states the rule the
  pages follow, and says that anything of this shape arriving in future belongs in the rewrite rather
  than in `UNEVIDENCED_CLAIMS`.

Nothing moved from `UNEVIDENCED_CLAIMS` into `MODEL_CLAIMS`: the ED replacement's claim was already
pinned, and the community count has no replacement claim to pin.

## Coordinator's additional item — the citation that could not fail

`community-index/enumeration/a-team-name-is-what-a-referral-stores` cited a doc comment restating its
own claim. It now cites `COMMUNITY_TEAM_PAGE_DERIVATION` — `id: communityTeamSlug(name), name, }));`
— which carries the asymmetry: the id transforms, the name does not, and prettifying the name forces
`name,` to become `name: something(name)`.

The mechanical guard landed with it: `isEntirelyComment` in `tests/ward-statistics-claims.test.ts`
rejects any evidence string that is entirely comment, with a failure message that explains why prose
cannot witness a claim. It is exercised on the historical example first — a predicate that returned
`false` for everything would pass the sweep by checking nothing, and today the register correctly
holds no comment-only citation for it to catch.

Added as a **fifth item** in the register's "what this cannot catch" list, marked as guarded rather
than merely listed, with the reversal recorded: the whole-type-body citations are the strongest ones,
and length was never the property that mattered — falsifiability was.

## New assertions

- `tests/ward-community-index.test.ts` — four tests scanning the component's leading doc comment: a
  non-vacuity floor, **no numeral**, no spelled-out tens count, and that the explanation around the
  removed count survives. Scoped to that comment because the rest of the file legitimately holds
  digits (`<h1>`, `=== 0`, `404`) and a whole-file scan would need exceptions for all of them.
- `tests/ward-statistics-sections.dom.test.tsx` — one test on the rendered ED paragraph: non-vacuity,
  the model property is stated, **no numeral**, and none of `most `, `seeded`, `fixture`. Deliberately
  excludes `many`, because the paragraph legitimately asks "how many people this department is
  currently waiting on".

Digit classes are written out as `[0123456789]` rather than `\d` — no escape sequence is involved, so
a literal backslash-b cannot arrive as a backspace byte.

The first version of the community-index guard caught **my own violation**: the ⚠️ paragraph I added
quoted "sixty-five" while explaining why it was removed. Rewritten.

## Also touched, and why

`tests/ward-community-index.test.ts` and `tests/ward-community-index.dom.test.tsx` each repeated the
count in their own doc comments. Both are in the brief's file scope and both carried the same
defect, so the counts came out of their prose too.

## Not touched

`ward-model.ts`, the seed, `ward-nav.ts`, `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts`.
The `it.fails` nav tripwire was left alone and still passes as expected.
