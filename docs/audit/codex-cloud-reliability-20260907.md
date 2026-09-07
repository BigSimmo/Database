# Database Codex Cloud reliability audit — 2026-09-07

Scope: Database development environments, GitHub shell authentication, setup, maintenance,
runtime dependencies and provider boundaries. Owner: repository owner; implementation and
verification: this Cloud repair task. This is not clinical production acceptance.

## Confirmed failures and repairs

| Finding                                                                                               | Repair                                                                                                                                | Regression proof                                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The default Database environment had no GitHub CLI credential.                                        | Owner authorized an existing local credential to be stored as encrypted `CODEX_CLOUD_GITHUB_PAT`; authenticate before ordinary setup. | Fresh and resumed Cloud tasks passed the live GitHub gate.                                 |
| The documented setup authenticated after the profile could remove its secret.                         | A dedicated connected-only lifecycle wrapper authenticates first and unsets the secret before child setup commands.                   | Lifecycle tests check ordering and absence of credential variables in child processes.     |
| Maintenance required the setup-only secret on every invocation.                                       | Reuse valid `gh` authentication when the setup secret is absent.                                                                      | Cached-maintenance and missing-cache regression cases.                                     |
| A repository-readable token lacked required scopes; failure occurred after a full dependency install. | Validate authentication, identity, protocol and scopes before dependency work.                                                        | Authentication preflight tests and fail-fast lifecycle cases.                              |
| Pasted hosted scripts could drift from repository instructions.                                       | Version setup and maintenance in `scripts/run-codex-cloud-github.sh`.                                                                 | Both commands share one tested entrypoint; ordinary offline setup stays unchanged.         |
| Caller tracing or login output could expose a credential.                                             | Disable tracing before credential use, suppress login output, pass the token only on stdin, and restrict the file-creation mask.      | Synthetic credential remains absent from stdout/stderr even with caller `bash -x`.         |
| Old task reports referred to a local commit absent after resume.                                      | Require current HEAD/diff and exact destination checks before publication.                                                            | Original task reported its reconstructed checkout explicitly; no diagnostic push occurred. |

## Hosted evidence

- [Connected v2 diagnostic](https://chatgpt.com/codex/tasks/task_e_6a9e7877864c832286210bab19528614):
  `npm run check:github-shell-access:live` exited 0.
- [Default-environment diagnostic](https://chatgpt.com/codex/tasks/task_e_6a9e7d3ea4748322a97d5588d6693e11):
  the same gate exited 0, `CODEX_CLOUD_GITHUB_PAT` was absent in the agent phase, and Git status
  was clean.
- [Previously failed GitHub-mention task](https://chatgpt.com/codex/tasks/task_e_6a9e6ea507cc8322ac3a44b60ecdd2ad):
  the resumed task passed the same gate with exit 0 and made no diagnostic code or GitHub writes.

Those runs used the repaired hosted inline commands before the tracked wrapper was published.
They prove GitHub identity `BigSimmo`, Database repository access, PR/Actions reads, and feature-branch
push authentication by dry run. Review mutations and Actions reruns were capability-checked, not
performed. They do not prove that every future write will satisfy branch protection or repository hooks.

The default-environment task also completed the runtime audit:

- `npm run check:codex-cloud -- --runtime` — exit 0; runtime, dependency lock, OCR tools,
  browser installation, remote identity and sanitized environment contracts passed.
- `npm run diagnose:codex-cloud` — exit 0, `HEALTHY`, zero locally detectable issues.
- `npm run check:playwright-browser-revision` — exit 0; Chromium revision 1234 launchable.
- `bash scripts/check-codex-cloud-raw-env.sh` — exit 2, `FAIL-KNOWN / CONTINUE-RESTRICTED`:
  the launcher still injects `OPENAI_BASE_URL`. No other provider variables were reported.
  The documented profile/shim boundary removes it for restricted provider-free work.
  This is not a clean raw-parent verdict and cannot be repaired by a repository PR.
- `npm run check:production-readiness` — exit 1 at `check:privacy-readiness:release`;
  `scripts/production-readiness.ts` did not execute. The reviewed commit
  `d3074946a917cac378de64284c67cbc1d4dc58fa` was unavailable in the shallow checkout.
  OpenAI ZDR, OpenAI/Railway DPAs, cross-border basis and privacy notice evidence remained
  pending; clinical PHI minimisation remained partial. A release-specific review must fetch
  the reviewed commit and supply the required governance evidence. Neither bypassing the
  validator nor adding clinical credentials is an environment repair.

## Local regression evidence

The focused GitHub access and existing Cloud setup contracts passed (59 tests). All eight
new lifecycle tests passed after correcting the Windows Bash fixture PATH: Git for Windows
prepends its real Git executable at startup, so the harness now selects its mocks inside
the shell. This prevents a fixture from accidentally using the real GitHub tools.
The tests exercise authentication ordering, cached maintenance, missing/insufficient
credentials, secret suppression under tracing, profile restrictions and failure propagation.

## Operating and recovery contract

Use the complete commands in [Setup and maintenance](../codex-cloud.md#setup-and-maintenance).
Keep the working hosted commands until the wrapper exists on the branch a task will check out.
Both repaired hosted environments now select the wrapper when present and retain the working
inline commands otherwise. Opening a PR alone does not install its scripts on `main`; after
merge the saved branch-aware routing adopts it automatically.

On `GH_AUTH_MISSING`, `GH_LOGIN_FAILED`, or `GH_REQUIRED_SCOPES_MISSING`, replace the encrypted
GitHub secret with an owner-authorized credential for the intended repository. Never relax the
scope check, publish the credential, or add clinical provider secrets to get a development
environment past a production-readiness check. Then obtain fresh-task and resumed-task evidence.

Rollback: restore the prior working hosted setup/maintenance commands; the wrapper is opt-in and
ordinary offline setup is unchanged. If withdrawing shell access, remove the encrypted secret,
invalidate the authenticated environment cache, and revoke the credential at GitHub as appropriate.
Deleting only the setup secret does not remove an already cached `gh` credential.

Expiry/revocation, GitHub outages, branch policies, Cloud launcher behavior and host capacity remain
external dependencies. The final live gate detects access failures; no script can guarantee they
will never recur. Clinical providers remain offline; deployment, live clinical data, paid API
acceptance and physical-device browser acceptance remain separate work.
