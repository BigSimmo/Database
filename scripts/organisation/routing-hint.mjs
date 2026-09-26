// Routing advice before editing (organisation framework, stage 3). The map knows which area owns
// a file, but not which checks a change to it needs; the repository's own path-aware planner does.
// This module only points at that planner. It never runs it and never picks checks itself.
//
// The planner is `npm run workflow:flightplan -- --files <a,b>` (scripts/productivity-workflow.mjs):
// offline and read-only, it classifies the paths through scripts/ci-change-scope.mjs and prints
// the smallest local checks plus the provider-backed commands that need approval.

export const PLANNER_SCRIPT = "workflow:flightplan";

// Characters a POSIX shell passes through unquoted. Anything else (route groups such as
// `(search-app)`, dynamic segments such as `[id]`, spaces) is double-quoted.
const SHELL_SAFE = /^[A-Za-z0-9._/@+:=,-]+$/;

function normalise(file) {
  return String(file ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
}

function shellArgument(value) {
  return SHELL_SAFE.test(value) ? value : `"${value.replace(/["$`]/g, (char) => `\\${char}`)}"`;
}

/**
 * One line pointing at the path-aware planner for these files. The planner takes a
 * comma-separated list, so a path that itself contains a comma is left out; with no usable path
 * the line points at the planner's default (the current change).
 */
export function routingHint(files = []) {
  const usable = [...new Set((files ?? []).map(normalise).filter((file) => file && !file.includes(",")))].sort();
  const why = "the smallest local checks, and which provider-backed steps need approval first";
  if (usable.length === 0) return `Before editing, plan the checks: npm run ${PLANNER_SCRIPT} (${why}).`;
  const noun = usable.length === 1 ? "this path" : "these paths";
  return `Before editing, plan the checks for ${noun}: npm run ${PLANNER_SCRIPT} -- --files ${shellArgument(usable.join(","))} (${why}).`;
}
