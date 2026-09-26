// Shared reader for the repository's path-based safety lists, used by the organisation
// framework (edit warnings, PR helper, coverage checks). It never decides policy itself:
// `scripts/pr-policy.mjs` owns the lists, and this module only asks it about a file.

import { classifyPullRequestFiles } from "../pr-policy.mjs";

export const SAFETY_CLASSES = Object.freeze(["ragRanking", "clinicalRisk", "migration"]);

/** Which safety lists cover one repository-relative path, as pr-policy classifies it. */
export function safetyClassesFor(file) {
  const result = classifyPullRequestFiles([file]);
  return SAFETY_CLASSES.filter((name) => result[name]);
}

/** True when the path is on at least one safety list. */
export function isOnSafetyList(file) {
  return safetyClassesFor(file).length > 0;
}
