# Recovery bundles

Git bundles committed as disaster-recovery evidence for the Ward Flow control plane, referenced by
[`BUILDER-ACTIVATION-RECEIPTS.md`](../../BUILDER-ACTIVATION-RECEIPTS.md).

⚠️ **The bundles themselves are NOT on the published branch, and this file is why that is visible
rather than silent.** They exceed GitHub's 100 MB blob limit, so the publication branch is built
from the working tree with them removed. On the working branch this directory holds the bundle; on
the published copy it holds only this note.

That difference used to make the directory disappear entirely, which failed `docs:check-links` with
a dangling reference from a document whose statement was still true — the bundle does exist, just
not here. A directory that exists on both branches keeps the reference honest in both places and
keeps the reason for the absence written down next to the absence.
