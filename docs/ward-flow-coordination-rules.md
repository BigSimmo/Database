# Coordination rules and locks — five chats, one repository

**Owner decision, 2026-08-29**, when asked whether to keep five parallel chats or collapse to one:

> *"Please keep it but create clear rules and locks for risky editing and build in coordination rules
> where chats will contact other relevant chats and update all documentation and again edit files
> that are safe and appropriate etc."*

**Everything below is measured from collisions that actually happened on 29–30 August, not designed
from what seemed likely.** Where a rule has no evidence behind it, it says so.

---

## 1. The price of parallelism, stated honestly before the rules

**A two-branch fold that went RIGHT still produced:** a conflict whose **wrong resolution was the
green one**, a fourth conflict nobody predicted, and seven failures no single branch could see. Both
branches were small, disjoint by intent, and coordinated hourly.

**That is the cost with the process working.** Anyone tempted to add a sixth chat should be shown
that number rather than a success story.

---

## 2. What actually collides — the four real ones

Most feared collisions are not real. These four are, and three of them are invisible to the checks
people reach for.

### 2.1 The git index is shared, and it is the sharpest edge

**A commit includes the whole index, not the paths you name.** So a subagent running in a worktree
where the controller has staged files **commits the controller's work under the subagent's message.**
Nothing errors.

- **Never `git add -A`.** Ever. Name every path.
- **A controller holding staged files must tell its subagents not to commit**, in the brief. The
  guard cannot be the index, because the index is the thing being shared.

### 2.2 One worktree, one committer — and this is enforced, not conventional

**Two chats in one worktree can never both commit, by construction.** The pre-commit hook refuses
while any other file under `src/components/` or `tests/` is unstaged or untracked.

**The enforcement looks like an unrelated documentation error rather than a lock**, which is why
sessions try to work around it. It is not a convention that can be relaxed for a quick change.

### 2.3 Custody is granted by a message, never inferred from a state

**A mutation probe restores between steps. So the tree reads clean at exactly the moments it is most
dangerous to touch, and no git command can see the difference.**

`git status --porcelain` empty is a fact about **one instant**. Custody is a fact about **a process**.

- **Only the holder can say a tree is free, and only after its own work has stopped.**
- **A clean read plus no handover line means WAIT.**
- **Say the state AND its time:** *"clean at `b386ab9f3`, probe finished, yours"* is a handover.
  *"clean"* is a reading.

### 2.4 The main-line worktree is a baton, not a room

**A branch can be checked out in one worktree at a time, and the owner has forbidden new worktrees.**
Three of five chats want the same one. **That — not file collisions, not the commit hook — is why the
main line's work is a queue.**

**Announce taking it and announce releasing it.** Both directions, explicitly.

---

## 3. The instruments, and which ones lie

| Question | Use | Do NOT use |
| --- | --- | --- |
| Has this file really changed? | `git hash-object` on both versions | `git status --porcelain` — **it cried wolf four times in one day**, every one a line-ending artefact with a byte-identical blob |
| Will these branches merge cleanly? | commit both sides, THEN `git merge-tree`, then report | `merge-tree` over a dirty tree — **it is blind to working trees and says nothing about it** |
| Did that commit ship code? | `git show --stat` | the commit message — **a commit that RECORDS a decision reads identically to one that IMPLEMENTS it** |
| Which branch is a chat on? | `git -C <worktree> rev-parse --abbrev-ref HEAD` | a registry row, a session store, or the branch's name |
| Is anyone editing this right now? | **ask them** | **nothing. No git command sees uncommitted work** |

**A rule that produces false stops teaches people to ignore it.** `git status --porcelain` failing
four times in a day is not a safety margin; it is training.

---

## 4. When one chat must contact another

**Not "when in doubt" — that produces either constant noise or none.** These five, and they are
specific:

1. **Before touching a file another chat owns.** Ownership is in the registry; verify with
   `git rev-parse <their-branch>:<path>` before assuming.
2. **When a decision makes another chat's work wrong.** The moment you know, not when convenient.
3. **Before taking the baton, and on releasing it** — with the SHA and the tree state.
4. **When you are about to land something cross-cutting** — the clock is read by 50 of ~71 test
   files; every other chat's gate results become meaningless until they take it. **Say so before, not
   after.**
5. **When you have already sent something the other chat is planning around.** State what has gone
   out **before** any proposal about who does what next.

**Never message to ask whether a chat has finished.** Use an idle notification.

**And never ask another chat to do something your own permissions blocked.**

---

## 5. What may be edited safely, without asking

- **Files only your branch has touched since the merge base.** Check, do not assume:
  `git rev-list --count <base>..<other-branch> -- <path>`.
- **Your own documents**, as listed in the ownership registry.
- **Anything in your own worktree that no other branch has modified.**

**And the three that always need a message first:** a file another branch has changed; a shared
fixture; anything named in another chat's in-flight brief.

---

## 6. The documentation half of the ask

**A change that absorbs, renames or grows a shared thing updates the documents naming it in the same
commit** — the way adding a route updates the site map in the same commit.

**This is the rule that would have prevented the day's worst confusion.** The ownership registry
named the wrong live branch for a day. **Nobody was careless:** `claude/ward-flow-ward-board` was
correct every time it was named, right up to the fold that absorbed it; the work moved to
`print-fixes` and the registry did not move with it.

**"Be careful with branch names" cannot be checked and was not the failure. "The same commit" can be.**

**And when correcting a document: correct the body, never only prepend a note.** A stale section
under a fresh correction makes the page look maintained while the wrong text stays quotable — and the
wrong text is what gets quoted, because it sits where a reader expects the answer.

**Then apply the fact-versus-record rule:** a statement about *now* gets corrected; a record of what
was true *then* gets dated and never back-dated; a number whose basis moved gets **re-measured, never
renumbered**.

---

## 7. Before building anything: prove it is not already built

**The owner's instruction after a plan assigned already-shipped work twice within an hour.** In
order, and the first has no command:

0. **Ask the chats.** No git operation sees uncommitted work, and **this check fails silently
   whenever anybody is merely busy rather than careless** — which is why it goes first.
1. **`git grep` for what the finished work would CONTAIN**, not for a name you guessed. The absence
   of your guess is not the absence of the feature.
2. **`git show --stat`** to tell a recorded decision from an implementation.
3. **Check your BRIEF against the filesystem** — `git ls-tree`. A wrong path usually makes an agent
   go hunting and succeed, **which is worse than failing: the work lands and the brief stays wrong.**

---

## 7b. Every baton handover carries the stranded documents

**Owner instruction, 2026-08-30, after six of nine rules documents were found missing or stale on the
line everyone builds from** — including the plan a chat was building from, and a rule the owner
himself had written that morning.

### The structural cause, because the fix has to match it

**The rules session cannot land its own work at all.** A branch checks out in one worktree at a time,
new worktrees are forbidden, and that worktree belongs to whoever holds the baton. **So every
document the rules session writes is stranded by default.**

**That is not an oversight. It is the shape of the arrangement**, and it will keep producing the same
defect until something mechanical carries the documents across.

**And the harm is not "a document is out of date".** The working line's governance document listed
**"No diagnosis"** as a live refusal for hours after the owner reversed it and a chat had already
built the field. **A stranded rules document does not merely fail to inform — it actively forbids
work that has been approved and shipped.**

### The rule

**Whoever releases the baton runs this before handing it on. It is part of the handover, not a
favour, and it needs no judgement:**

```
git checkout claude/Wardquestions -- \
  docs/ward-flow-mission-and-refusals.md \
  docs/ward-flow-changeable-data-rule.md \
  docs/ward-flow-coordination-rules.md \
  docs/ward-flow-questions-rule.md \
  docs/ward-flow-decisions-2026-08-29.md \
  docs/ward-flow-master-sequence-2026-08-29.md \
  docs/ward-flow-ward-board-plan-corrections-2026-08-29.md \
  docs/superpowers/plans/2026-08-29-ward-flow-referral-front-door.md \
  docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md
git commit -m "docs(ward-flow): carry the standing rules onto the working line"
```

**Documentation only. No test reads any of them, so it cannot affect anything in flight**, and it
happens at the one moment somebody is already in that tree.

> **NINE PATHS, NAMED. NEVER A GLOB — and this is not fastidiousness.**
>
> The first draft of this rule said `docs/ward-flow-*.md`. **Checked before publishing rather than
> after, that pattern selects 75 files**, including `ward-flow-complete-ledger.md` — **the design
> session's ledger** — the whole phase-3 workspace, the roadmap, and every historical handover.
>
> **A rule written to stop sessions overwriting each other would have had one session overwrite
> another's register of record**, in a single command, presented as safe and requiring no judgement.
> The convenience is exactly what made it dangerous: **a glob is a claim about ownership that nobody
> checks, wearing the appearance of a path.**
>
> **Add a path here only when this session authors that file.** If a document ever moves owner, the
> line moves with it.

**If the copy would lose anything, it will show in the diff** — and the answer is then to say so
rather than to resolve it, because the rules session is the author and this is the one case where
"take one side wholesale" is correct by construction.

### The detector, so the state is visible rather than remembered

**Run from any worktree. It answers "what does the working line actually hold", which is a different
question from "what did I write".**

```
W=claude/ward-flow-phases-6-7-design
for f in $(git diff --name-only $(git merge-base origin/main claude/Wardquestions)..claude/Wardquestions -- docs/); do
  if ! git cat-file -e "$W:$f" 2>/dev/null; then echo "ABSENT      $f"
  elif git diff --quiet "$W:$f" "claude/Wardquestions:$f"; then echo "up to date  $f"
  else echo "STALE       $f"; fi
done
```

### The principle, which is the part that generalises

**A document that cannot reach the line it governs is not a rule. It is a draft.**

Every rule written in a session that cannot land it is, until carried, **a private opinion held
confidently.** The author reads their own copy, believes the rule is in force, and reasons from it —
which is exactly how a correction to a false instruction sat unread for hours while every other
session was told the opposite.

**So the test for any new rule: name the line it governs, and check it is there.** Writing it down is
not the same as putting it in force, in precisely the way `git log` is not the same as
`git show --stat`.

---

## 8. The failure this whole document exists to prevent

**An absent signal reads exactly like a passing one.**

Every collision above is a case of it: a clean `git status` during a mutation probe, a `merge-tree`
blind to a working tree, a guard that stopped guarding, a registry answering a question whose
premise had expired.

**So the standing test for any rule or check added here: what does this indicator do WHILE the hazard
is active?** If the answer is *the same thing it does when there is no hazard*, it is measuring
something else, and it will be trusted anyway.
