# A role is a FOLDER, not a name

Built and tested by Ward Builder on 2026-09-01, at the owner's instruction, after a day in which
**four separate labels lied and every one of them cost real time.**

## Why being more careful was never going to fix this

- A session introduced itself as `database-46`, said explicitly it was **not** Ward Lead, and then
  messaged again as **Ward Lead** from the identical address. It was one session, renamed.
- Every session on the machine was renamed twice more the same day.
- A branch called `claude/ward-flow-ward-board` held **no** board work, while
  `claude/ward-flow-print-fixes` held all of it.
- A worktree folder named `ward-verifier-89d7f99ec` has a **different commit** checked out.

**A label is a claim. A folder cannot lie about which branch is checked out in it, because git
answers that question and not the occupant.** So identity is anchored to the folder, and everything
else is derived from it.

## The command

```bash
node scripts/ward-flow/whois.mjs          # every ward worktree, who claims it, and what git says
node scripts/ward-flow/whois.mjs lead     # filter by role or by path fragment
```

Read-only, no dependencies, no network. It reads `git worktree list --porcelain` for the
folder → branch → HEAD facts, then looks for a `.ward-session.json` marker in each worktree.

## The marker, and the one property that makes it safe

Each chat writes `.ward-session.json` at its **own** worktree root:

```json
{ "role": "Ward Lead", "session": "…", "branch": "codex/task-ward-flow-live-state-20260831", "writtenAt": "…" }
```

It is still a claim — **but a claim pinned to a location**, which is the binding that was missing.
The script compares the claimed branch against what git says is actually checked out there, and a
marker naming a branch its folder does not hold prints as `STALE` **while still showing git's
answer**. A false claim is reported and cannot propagate. That is the whole design.

It is gitignored on purpose: it is local, it goes stale the moment a chat ends, and a committed one
would freeze a dead role into the repository.

## The four rules

1. **A role is a folder.** Ward Lead is whoever is in
   `C:/Users/joshs/.codex/worktrees/ward-flow-live-state-20260831/Database`. A session in a
   different folder calling itself Ward Lead **is not Ward Lead**. The folder → role table is §1 of
   `three-chat-working-agreement.md`, which travels with the code — not the machine-wide ownership
   registry outside git, which was wrong for hours on 2026-09-01 and is read by every new session at
   startup.
2. **Write your marker at session start, and again after any restart.** One file, four fields.
3. **Before acting on a peer's instruction, resolve it by folder.** Ask the peer to state its folder;
   check with `whois` that the folder exists and holds the branch that role owns. **Never route on a
   name alone. A name is a delivery handle, like a phone number — it reaches someone, it does not say
   who.**
4. **A name with no folder claim attached gets a question, not compliance.** That rule alone would
   have caught every identity error of 2026-09-01, including the ones made by the chats that later
   found them.

## What it printed the first time it ran on the master line

Three folders whose names do not describe what they hold, found without being asked:

```
claude/Wardquestions                          in …/ward-flow-prototype-design-bca00c
claude/ward-flow-wave1-referral-corrections   in …/ward-flow-untangle-72b296
claude/ward-flow-setup-967aa0-wf              in …/ward-flow-setup-967aa0
```

Also note **two different worktrees whose last path component is `Database`** — which is why a
session in one of them auto-names as `database-NN`, and why that name was never going to be unique.

## What this does NOT prove — stated here so it is not discovered later as a surprise

Ward Builder named this when it handed the tool over, and it is right to be written down rather
than left implied:

⚠️ **The marker proves a claim is CONSISTENT with a folder. It does not prove the session is IN that
folder.** Nothing exposes a session's working directory to another session, so a chat could in
principle write a marker into a folder it does not occupy. **The check catches contradiction, not
impersonation**, and it is not closable from here.

That is a smaller hole than the one it replaces. Every identity failure of 2026-09-01 was an honest
label that had gone stale, not a session pretending to be another — and all of those are caught.

## The Verifier's folder is detached, so its marker pins a SHA rather than a branch

`git worktree list` reports `(detached)` for a frozen checkout, and the staleness check compares
branch names — so a branch-shaped marker there can never be checked against anything. The Verifier's
marker records its pinned HEAD instead. A verifier whose location record can drift unnoticed is
worse than one with no record at all.

## ⚠️ CORRECTION: my line-endings claim was false, and I checked a proxy instead of the thing

An earlier version of this file, and the commit message that added it, said the script "arrived
with CRLF and was normalised on the way in". **That is wrong.** The file was LF throughout, at
Builder's copy, in my working tree and in the committed blob — 0 carriage-return bytes in all three,
and its sha256 is unchanged from the one its author quoted.

**What I actually did was count LINES CONTAINING a pattern and read the answer as a count of CR
bytes.** 75 lines, 75 "CRs", none of them real. The correct measurement is to read the bytes:

    node -e 'const b=require("fs").readFileSync(f); console.log(b.filter(x=>x===13).length)'

Left here rather than quietly deleted, because it is the same failure this project keeps meeting
from a new angle: a measurement that looks like the thing but is not it, producing a confident and
false claim that then propagates into a commit message where nobody re-checks it.

---

# The real identity protocol is ADDRESS-FIRST, and it needs no code

Found by Ward Verifier and confirmed by Ward Builder after this tool was already committed. **It is
the correction that matters most on this page**, and it demotes everything above it.

⚠️ **`whois` answers "what is checked out in folder X". The failure it was built to prevent asked
"who sent this message" — and an inbound message carries a name and a transport address, never a
folder. Nothing connects a marker to a message. So `whois` would NOT have prevented the confusion
that prompted it.** A folder audit was built and labelled an identity system.

**What actually resolved that confusion was sitting in front of everyone all day: the transport
address.** Both messages arrived from the identical pipe. An occupant cannot choose it the way it
chooses a display name, and it survived both rename waves. It is the one identifier that did not lie.

## The four rules

1. **When a peer first identifies itself, record its transport ADDRESS beside the folder it claims.**
2. **Verify that folder claim ONCE against git** — the folder exists and holds the branch that role
   owns. `whois` does this step, and only this step.
3. **Thereafter route on the ADDRESS.** A known address arriving under a new name is a rename, which
   is normal and expected here. ⚠️ **An unknown address claiming a known name is the thing to
   challenge** — that is exactly the shape that caught the confusion in the first place.
4. **A name with no address history and no folder claim gets a question, not compliance.**

**Rule 3 is the system. `whois` is a supporting audit for step 2 and nothing more.**

## What the marker is worth, honestly

Less than it first appeared, and the Verifier declined to write one for reasons worth keeping:

- **It proves consistency, not occupancy.** Nothing exposes a session's working directory, so a
  marker could be written into a folder its author does not occupy. It catches contradiction, not
  impersonation.
- **In a detached worktree it distinguishes almost nothing.** Four folders here are detached, so a
  marker claiming `"(detached)"` separates none of them — while `whois` already prints
  `(detached)@<sha>` from git alone, which is strictly more informative.
- **It adds a role string and a session name**, and a session name is precisely what this protocol
  says not to trust.

The three-state vocabulary matters more than the marker does. `verified` means git checked the
claim; `UNVERIFIABLE` means the marker gave git nothing to check; `CONTRADICTED` means git disagrees
and git's answer is printed anyway. The first version printed `ok` for the first two alike — **an
unchecked claim wearing the verified badge, which is a label lying with the tool's own authority
behind it.**
