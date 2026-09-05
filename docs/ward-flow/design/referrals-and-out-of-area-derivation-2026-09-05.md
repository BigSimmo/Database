# `referrals` and `out-of-area` — what they render today, derived from the code

**Assigned by Ward Lead, 2026-09-05**, ahead of the nine-screen design overhaul. Read-only; no
markup written. Every list below carries the command that produced it, per the owner's standing
rule that a list reaching him is derived rather than assembled.

**Measured at `3cc56c47d`.** Re-derive before acting — every figure here expires.

---

## 1. The two screens

| Route                            | Component                           | Lines |
| -------------------------------- | ----------------------------------- | ----: |
| `/mockups/ward-flow/referrals`   | `referrals/referral-board.tsx`      |   564 |
| `/mockups/ward-flow/out-of-area` | `out-of-area/out-of-area-board.tsx` |   234 |

```bash
grep -n "out-of-area\|referrals" src/components/ward-management/ward-nav.ts | grep href
wc -l src/components/ward-management/referrals/referral-board.tsx \
      src/components/ward-management/out-of-area/out-of-area-board.tsx
```

⚠️ **BOTH ALREADY RENDER A TABLE.** `ward-referral-board-queued-table`, `-decided-table`,
`ward-out-of-area-table` all exist today, each paired with a `-cards` sibling. So the "modular
tabular layout" requirement is not a greenfield addition here — it is a **replacement of two
existing table implementations**, and the risk is a third pattern rather than a first.

```bash
grep -o 'data-testid="[^"]*"' src/components/ward-management/referrals/referral-board.tsx \
  src/components/ward-management/out-of-area/out-of-area-board.tsx | sort -u
```

---

## 2. What feeds them

```bash
grep -E "^import|^} from" <component> | grep -oE '"@/components/ward-management/[a-z-]+' | sort -u
```

|                                    | `referral-board` | `out-of-area-board` |
| ---------------------------------- | :--------------: | :-----------------: |
| `ward-flow-provider` (live state)  |        ✅        |         ✅          |
| `ward-referrals` (`referralState`) |        ✅        |         ✅          |
| `ward-clock`                       |        ✅        |         ✅          |
| `ward-priority`                    |        ✅        |          —          |
| `ward-model`                       |        ✅        |          —          |
| `ward-admissions`                  |        —         |         ✅          |
| `ward-distance`                    |        —         |         ✅          |

Neither computes a derivation inline. Both read the shared provider, so both inherit one clock —
the property `community-screen.tsx` records as _"a wrong clock looks wrong; a wrong length of stay
looks plausible."_

---

## 3. Real versus invented — the part the owner replaces later

### 🔴 Invented

- **Every travel band on `out-of-area`.** `ward-distance.ts` resolves through
  `SYNTHETIC_TRAVEL_BANDS`, and its own doc comment says a band is never written onto a record
  _"because a stored band would outlive the day the placeholders in `ward-travel-bands.ts` are
  replaced with checked values."_ The screen says so itself: _"Every bed, every occupancy and every
  travel time in it is invented."_
- **Every referral, admission and bed** on both screens — the seeded fixtures in
  `ward-movements.ts` and `ward-admissions-seed.ts`.

```bash
head -40 src/components/ward-management/ward-distance.ts
grep -c 'id: "RF-' src/components/ward-management/ward-movements.ts    # 13 seeded referrals
```

### ✅ Real, drawn from the repository

- **Unit, site and emergency-department names** — `ward-sites.ts`, and the catchment table behind
  `ward-catchment.ts` (537 suburbs from five WA Health documents).
- **The referral state machine** — `referralState` derives from the destinations rather than being
  stored beside them.

### ⚠️ Neither, and worth flagging

`out-of-area` renders **two counts**, and the second exists because the first cannot be computed
for everybody:

> _"N people are recorded as being in a bed far from home."_
> _"M more could not be placed in a band because this prototype holds no travel time for their home region."_

**The second figure is a measure of the fixture's gaps, not of the ward network.** Any redesign that
promotes these to headline tiles must keep them adjacent and keep the second one's sentence, or the
first becomes a statewide claim it is not. `out-of-area-board.tsx:112-119`.

---

## 4. Sweep for claims tonight's free-text change made false

**Bounded result: one comment, no rendered sentence.**

```bash
grep -n -i "free text\|free-text\|never a name\|no name\|permitted facts" \
  src/components/ward-management/referrals/referral-board.tsx \
  src/components/ward-management/out-of-area/out-of-area-board.tsx
```

- 🟡 `referral-board.tsx:93` — _"the fixed reason list — the entire mechanism by which this phase
  justifies holding no free text — worthless on the board."_ Still true **of decline reasons**
  (`declineReason` remains a closed union) but reads as a claim about the phase, and the phase now
  holds free text. **One-clause scope fix, held until the `FD-13` ruling lands**, because the
  wording may depend on the answer.
- 🟢 **Neither rendered governance banner makes a free-text or a name claim at all.** `referrals`
  says only that units are in fixed order and the board places nobody; `out-of-area` says only that
  every figure is invented. Both unaffected.

⚠️ **This sweep covers my two assigned screens only.** It is not a repository sweep and must not be
read as one.

---

## 5. What I would carry into the redesign, and what I would not

**Keep, because each is load-bearing rather than decorative:**

1. **`out-of-area`'s second count.** See §3 — without it the first figure overclaims.
2. **The referral board's decided rows naming the unit AND the reason.** `referral-board.tsx:87`
   records why: a decline reason that cannot be read back makes the fixed reason list worthless on
   the board.
3. **"An acceptance does not erase a refusal"** — owner ruling 2026-09-01, _"keep the refusals
   visible on the board."_ A tabular redesign that shows one outcome per referral would silently
   reverse it.
4. **Absence stated in words** — a missing unit or reason reads "Not recorded", never an empty cell.
   In a table this is more exposed than in cards, not less: an empty `<td>` reads as a value.

**Do not carry:** the card/table duplication. Both screens currently render both; a "modular
tabular" pass is the moment to decide which owns the small-screen case rather than keeping two.

---

## 6. Open before markup

- **Blocked on the `FD-13` count ruling** only for `referral-board.tsx:93`'s wording. Nothing else
  here waits on it.
- `design-language.html` and `second-edition-to-ckb-v2-role-map.md` are **not in this worktree** —
  reachable only via `git show f2e9357f8:<path>`. Awaiting Ward Lead's word on whether to merge
  master first.
- ⚠️ **`DESIGN-LANGUAGE.md` still names `community-home.html` canonical at `f2e9357f8`**, while the
  nine screens are built against `design-language.html`. Reported; not mine to edit.
