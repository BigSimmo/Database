# How the Ward Flow chats talk to each other

**Written 2026-09-01 after a day in which every serious near-miss was a communication failure rather
than a coding one.** Not one of the rules below is theoretical — each names the incident that
produced it.

**This file is short on purpose.** A long protocol is one nobody reads at 11pm. If a rule here ever
feels like paperwork, it has failed and should be cut.

---

## The roles, and what each may do

| Chat                   | Branch                                     | May                                                                                                                    | May never                                                 |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Ward Lead**          | `codex/task-ward-flow-live-state-20260831` | Merge toward the master line. Rule on conflicts, scope and design. Own the reducer, events, nav, seed and route files. | Be the only thing keeping another chat current.           |
| **Ward Builder One**   | `claude/ward-builder-community-route`      | Build its assignment. Merge the master line INTO its own branch whenever it likes.                                     | Merge toward master. Touch a path outside its assignment. |
| **Ward Builder Two**   | `claude/ward-builder-two`                  | Same.                                                                                                                  | Same.                                                     |
| **Ward Builder Three** | `claude/ward-builder-three`                | Same.                                                                                                                  | Same.                                                     |
| **Ward Verifier**      | detached, frozen                           | Check anything, name any ref, refuse anything.                                                                         | **Write a single file.** Move its pin.                    |
| **Ward Answers**       | detached, frozen                           | Explain to the owner.                                                                                                  | Build, edit, commit, or courier between chats.            |

**Only Ward Lead merges toward the master line. Everyone else merges FROM it, as often as they like,
without asking.**

---

## The eleven rules

### 1. Every claim names its tree and its measurer

_"`referredUnitIds` is at :481"_ is not checkable. _"On `codex/task-…` at `cd0e7d585`, I read
`ward-model.ts`"_ is.

**Incident:** two chats contradicted each other about whether the statistics route literals existed.
Both were right — about different trees. Hours went into it.

### 2. Mark echo. Say which half of your reply is independent

**One clause: _"taking this from you, not verified."_** Without it, a claim you were told comes back
looking like a second opinion.

**Incident:** Ward Lead told two chats a sequence was unreachable. Both adopted it and sent it back.
One claim made a round trip and returned looking like two independent confirmations. **It was wrong.**

### 3. A claim that dissolves work gets checked HARDER than one that creates work

A claim that creates work is checked because acting on it is expensive. A claim that removes work is
adopted because acting on it costs nothing. **That asymmetry is backwards**, and every false claim
that travelled today made work disappear.

⚠️ **Arriving from Ward Lead makes a claim LESS likely to be checked, not more.** Ward Lead is not
an authority on facts, only on decisions.

### 4. Three-dot for authorship. Two-dot for "what would I get"

    A..B    everything in B not in A, INCLUDING what B merged   → "what would I get"
    A...B   what B authored since diverging                      → "what did this branch do"

**Both look like "what did this branch change" and only one is.** Three attribution failures today
were all two-dot diffs read as authorship — one of them accused a chat of editing files it had never
opened.

### 5. Cite by symbol name; the line number is a hint

**A line number is a claim about a tree wearing the costume of a fact about a file.** Two chats cited
the same record at `:1455` and `:1301`; both were right on their own branch. On a branch that has
merely CHANGED a stale line gets caught by the next reader; on one that has DIVERGED it stays
plausibly wrong indefinitely.

### 6. Never route a blocked action through another chat

If a guard or a permission stopped you, **that is the answer**. Ask the owner, in his own session,
not a sibling with different settings.

**Incident:** a chat was blocked twice on a branch deletion, and asked Ward Lead to run it. Ward Lead
refused. **If a denied action can be re-issued to whichever chat has not hit the block yet, the block
means nothing** — however obviously harmless the action.

### 7. Prove an absence before reporting it

Run the same search for something you know is present. **A search that cannot find a known positive
has not established a negative.**

**Three separate mechanisms produced false absences today:** a leading `/` silently rewritten before
git saw it; a grep matching a prohibition inside a comment and reading it as a call; and — with many
sessions open — a command that never forked at all, returning output indistinguishable from a
finding.

### 8. Report the number that RAN, not the number that passed

**A vitest run that dies at startup looks exactly like a clean pass.** _"0 failed"_ and _"0 ran"_ are
identical in a summary line. Discovery floors guard the file count, not execution — both are needed.

### 9. Report a collision. Do not tidy it up

If another chat's work lands on top of yours, or your worktree changes under you, or you find your
commit on a branch you did not choose — **stop and say so.** Do not cherry-pick it back, however
safe and however cheap.

**Incident:** two writing agents were dispatched into one worktree, by the chat that had restated
that rule to four others the same evening. The affected agent stopped, and that is the only reason
the dispatcher found out. **A tidy recovery leaves a correct tree, a report saying "done", and no
signal at all** — the cost is not the thing to measure, the mechanism is.

### 10. Enumerate the file set. Put the coverage figure in the REPLY, not only in the report

A sweep briefed in prose is a silent coverage hole with a green verdict on it. Name the files, state
the count, and require the count actually seen to come back in the short reply — not just in a file.

**Incident:** a brief said `.ts` where it meant `.tsx`, so a sweep dropped all 51 DOM test files —
exactly where the defect being hunted lives — and covered 92 of 138. **The agent's own report
disclosed this honestly; the 120-word summary did not, and the summary is what got read.** A caveat
that survives only in a file is a caveat that does not reach the decision.

⚠️ **And grep is not a sweep for this class.** Every check-that-cannot-fail found on 2026-09-01 was
invisible to a pattern scan, because the fault is _where an assertion sits relative to a scope_ —
outside the negation, inside one branch of an if/else, comparing two values that both come from the
fixture. Report any mechanically-scanned batch as **unswept for that class specifically.**

### 11. Resolve every path in a brief against disk. A named path is a hint, not a fact

Rule 10 covers file SETS. **A single named path is just as capable of being wrong, and nothing about
naming one file rather than many makes it more reliable.**

**Three instances in one evening, from one chat, each a different way of being wrong:** `.ts` where
`.tsx` was meant, a line number stale by the time it was read, and a directory that had moved —
`ward-management/ward-daily-sheet.tsx` when the file lives at `ward-management/board/`. **Ward Lead's
briefs carried the same wrong directory**, so this is not one chat's habit.

**Two halves, and the second is what saved it:**

- **Resolve the path before dispatching.** One `ls` or `find`.
- ⚠️ **Tell the agent the path is a hint to verify, not a fact to trust.** The agent that met the
  wrong directory used `find`, located the real file, and **said so** — rather than reporting a
  missing file, or creating one at the path it was given. **That last outcome is the dangerous one:
  a brief naming a path that does not exist can produce a new file at the wrong location, and
  everything downstream will look correct.**

---

## When to message, and when not to

**Message immediately when:**

- You find something that makes another chat's work wrong. **Now, not in your report.**
- You are about to need a path you do not own.
- A ruling you were given turns out to be false, or your own claim does.
- You are handing back rather than reaching.

**Do not message to:**

- Ask whether somebody is finished. **Read `now.md` or the git log.**
- Relay a ruling you have not disambiguated. **A relay is a prompt to confirm, never a decision to
  act on.** Three of five relays on 2026-09-01 arrived altered.

**Name the chat and the branch, every time.** _"The Builder"_ is ambiguous across three of them, and
a verdict delivered against the wrong branch looks identical to a correct one.

---

## The one structural fix

⚠️ **Do not let Ward Lead's narration be what keeps you current.** Ward Builder One put it exactly
right: _"I am protected from drift by you narrating it, not by anything I can check."_

**Merge the master line into your branch whenever you finish a piece.** You never needed permission.
A status board and a talkative integrator are both memory, and memory going stale is the single
theme of this entire project.
