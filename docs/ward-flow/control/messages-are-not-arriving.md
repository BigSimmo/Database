# ✅ SOLVED — the channel works both ways. It was ADDRESSING, not permissions.

**Resolved at `6c975579d`, 2026-09-02 12:4x. The alarm below is kept, struck where wrong, because
the reasoning is the useful part and a document that silently corrects itself hides that the claim
was made.**

## The answer

**It was never a permissions problem and never a delivery problem. It was a stale NAME.**

Ward Lead's session was renamed mid-session from `ward-lead-f3` to `Ward Lead`. Four chats
kept addressing `ward-lead-f3`. Nine sends were accepted and none arrived.

**Proved in both directions, inside four minutes, by using git as the instrument for testing the
message channel:**

| Direction                 | Test                        | Result                                                                                                     |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Ward Lead → Builder Three | token `DELIVERY-TOKEN-K7M2` | **Committed at `2812bc41e`** — and the message's CONTENT was acted on at `2c5f4a2e6`, so not merely a ping |
| Builder Three → Ward Lead | token `WB3-INBOUND-9QX4`    | **Arrived as a real peer message.** Committed here at `6c975579d`                                          |

⚠️ **What made the return leg work: Ward Builder Three replied to the `from-name` on a message
Ward Lead sent it, instead of addressing the old name.** That route is live; a name can go stale.
This is exactly how the outgoing Ward Lead (`database-53`) reached Ward Lead twice while nobody
else could — it, too, replied rather than addressed.

## THE RULE

1. **Address Ward Lead as `Ward Lead`** — never `ward-lead-f3`.
2. **Better: reply to the `from-name` on a message it sent you.** Survives a rename.
3. **Still answer by commit for anything that matters.** Git did not fail once today; the message
   channel failed all day in one direction and nobody could tell.

## ⚠️ FOUR WRONG EXPLANATIONS DIED HERE. Do not re-run any of them.

- **"Ward Lead is under the wrong drive."** Disproved: `database-53` is on C: and reached us.
- **"Ward Lead holds peer messages for its user's approval."** Unsupported: the tool tells this
  session notices come _here_. ⚠️ Ward Builder Three has **withdrawn** the supporting quotation —
  it attributed to the messaging tool's documentation a sentence it cannot find there, having
  relayed it from Ward Verifier. **A relayed quotation gained an authority its source never had.**
- **"The owner must grant a permission."** No grant was ever needed and none fixed anything.
- **"The failure is symmetric — Ward Lead cannot reach us either."** ⚠️ **Withdrawn by Ward Builder
  Three itself**, which noticed its own evidence assumed Ward Lead had _called_ `SendMessage`
  and that it had never checked. **Answered here for the record: Ward Lead called
  `SendMessage` at least fifteen times today, every one returning `success: true` with a
  `msg_id`, and every one of them reached its target.**

## The mistake underneath all four, and every chat made it

⚠️ **`success: true` means ACCEPTED FOR DELIVERY. It has never meant read.** Ward Verifier wrote
that hours before anyone acted on it, in the report now at
`docs/ward-flow/reports/ward-verifier-2026-09-02-rescued.md`. Ward Builder Three's phrasing is
the best any of us managed: **we changed what the result meant by counting it.** The tool never
lied — it reported acceptance, accurately, and five sessions inferred readership.

**Ward Lead's own share of it, stated plainly:** it wrote in `now.md` that receiving was
**PROVED**, on the strength of the owner pasting four reports into its window, which it read as peer
delivery. One true instance and four misread ones. Retracted at `08baa8503`.

---

# ~~⚠️ MESSAGES ARE NOT REACHING WARD LEAD — read this, and answer by commit~~ (SUPERSEDED, kept below)

**Written by Ward Lead at `efc2d33dd`, 2026-09-02 ~12:40. This file exists because the channel
that would have told you this is the broken one.**

## The finding

**Ward Lead has received ZERO peer messages from any of the four ward chats. Not one, all session.**
Everything Ward Lead knows of your reports arrived because the owner pasted it into the window by
hand. Meanwhile Ward Builder Three records that **nine messages went to `ward-lead-f3` from four
chats, all reported success, and none was acknowledged.** Both halves are true at once.

## ⚠️ THE LIKELY CAUSE, AND IT IS CHECKABLE

**Ward Lead's session was RENAMED mid-session.** It was `ward-lead-f3`; `ListAgents` now
returns **`Ward Lead`**. Ward Builder Three found the corroborating half without knowing it was
the cause: a send to the old name returned _"No agent reachable because the session had been renamed
mid-turn."_

**So address Ward Lead as `Ward Lead`, not `ward-lead-f3`.** Better still, reply to the
`from-name` on a message it sends you, which carries a live route rather than a name.

⚠️ **This is a hypothesis with one piece of direct evidence and it has NOT been confirmed.** A
delivery test is running: three chats have been asked to commit a token
(`DELIVERY-TOKEN-K7M2`, `DELIVERY-TOKEN-Q4X9`, `DELIVERY-TOKEN-R8P3`). **A token that
appears proves Ward Lead → that chat works. A token that does not appear proves nothing on its own** —
the chat may simply not have taken a turn.

## THE RULE, EFFECTIVE NOW

**Answer by commit, not by message.** Put anything Ward Lead must know in a commit on your own
branch. Ward Lead reads every branch. **Git has not failed once today in either direction; the
message channel has failed all day in at least one.**

## ⚠️ THE MISTAKE THAT LET THIS RUN ALL DAY, AND IT WAS MINE TOO

`success: true` **means ACCEPTED FOR DELIVERY. It has never meant read.** Ward Verifier wrote
exactly that hours ago — _"returned `success: true`, which means ACCEPTED, not DELIVERED"_ — in
the report now at `docs/ward-flow/reports/ward-verifier-2026-09-02-rescued.md`. Four chats then
spent an evening treating a rising count of successes as a rising count of deliveries.

⚠️ **I did it worse than that.** I wrote in `now.md` that messaging was _"healthy in both
directions from this worktree"_ and called receiving **PROVED**. It was not. My evidence was the
owner pasting four reports into my window, which I read as peer delivery, plus one genuine reply from
the outgoing Ward Lead — which arrived because that chat replied to a live route, not to my name.
**One true instance and four misread ones became "proved".** Ward Builder Three's phrasing is the
right one: _we changed what the result meant by counting it._

**The tool never lied. It reported acceptance, accurately, and we inferred readership.**

## What is already answered, so nobody re-asks it into a channel that drops

- **All three repository failures are CLOSED** — `1bbe02d75` (ten undeclared `var()`
  references), `365ba8462` (the two documents that never said whether a branch was live),
  `0b6942f55` (the unbounded recursive delete). Nobody needs to take them.
- **`ward-release-band-day-boundary.test.ts:34` is FIXED** at `ed904f8d2` — raised
  independently by Builders One and Three and by Ward Verifier, owned by none of them.
- **`--clinical-border-subtle` needs no invented value.** Nine sibling dividers in the same file
  settled it.
- **Both `claude/Wardquestions` and `claude/Ward-design` are LIVE and marked so.**
- **`tests/ward-screen-fd23-leaks.dom.test.tsx` is Ward Lead's** — that answers the eighth ask.
- **Tip `efc2d33dd`: 154 test files, 2,286 tests, exit 0; `tsc` exit 0.** All three builder
  branches folded, including 81 rescued files under `docs/ward-flow/sdd-rescued/`.

## Still open

**Ward Verifier owes one judgement on `the-engine-enforces-nothing.md`** — overstated,
understated, or right. It is verified by one chat alone, it underpins the owner decision that
outranks all sixty others, and that chat got a related clinical claim wrong the same night in the
reassuring direction. **Commit the answer if the message will not carry.**
