// Weekly report section: suggested homes (organisation framework suggestion 5, "self-organising,
// only as proposals"). For each unplaced or not-yet-placed test or script, it proposes the area
// most of the file's local imports belong to, shows the vote, and prints the exact map line that
// would place it. It never moves a file, never edits the map and never touches a safety list; a
// person decides. (The plan's weekly pull request shrank to these proposals in the weekly issue.)
import { CODE_FILE, MAP_SYSTEMS_DIR, areasOf, inlineCode, loadPlacement, localImports } from "../weekly-lib.mjs";

const CANDIDATE = /^(?:tests|scripts)\//;
const LIST_MAX = 100;

/**
 * The vote for one file. A test belongs to the area of the code it tests, so imports of other
 * files under tests/ (helpers, fixtures) only vote when the test imports nothing else. Imports of
 * shared, ignored or unplaced files count towards the total but vote for no area.
 * @returns {{ area: string | null, votes: number, total: number, tally: [string, number][], helpersSkipped: boolean }}
 */
export function voteForHome(file, imports, placement) {
  let voters = imports;
  let helpersSkipped = false;
  if (file.startsWith("tests/")) {
    const outside = imports.filter((target) => !target.startsWith("tests/"));
    if (outside.length && outside.length < imports.length) {
      voters = outside;
      helpersSkipped = true;
    }
  }
  const tally = new Map();
  for (const target of voters) {
    const areas = areasOf(placement[target]);
    if (areas.length === 1) tally.set(areas[0], (tally.get(areas[0]) ?? 0) + 1);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const tied = ranked.length > 1 && ranked[1][1] === ranked[0][1];
  return {
    area: ranked.length && !tied ? ranked[0][0] : null,
    votes: ranked[0]?.[1] ?? 0,
    total: voters.length,
    tally: ranked,
    helpersSkipped,
  };
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function describe(file, status, outcome) {
  const label = `- ${inlineCode(file)} (${status})`;
  if (outcome.reason) return `${label}: no suggestion; ${outcome.reason}.`;
  const { vote } = outcome;
  const helpers = vote.helpersSkipped ? ", not counting test helpers" : "";
  if (!vote.area) {
    if (vote.total === 0) return `${label}: no suggestion; it has no local imports.`;
    if (vote.tally.length === 0) {
      return vote.total === 1
        ? `${label}: no suggestion; its one local import is not placed in a single area.`
        : `${label}: no suggestion; none of its ${vote.total} local imports is placed in a single area.`;
    }
    const leaders = vote.tally.filter(([, votes]) => votes === vote.votes).map(([area]) => inlineCode(area));
    return `${label}: no suggestion; a tie between ${leaders.join(" and ")} at ${vote.votes} of ${plural(vote.total, "import")} each${helpers}.`;
  }
  return `${label}: **${vote.area}**, ${vote.votes} of ${plural(vote.total, "import")}${helpers}. Add ${inlineCode(`${JSON.stringify(file)},`)} to \`paths\` in ${inlineCode(`${MAP_SYSTEMS_DIR}/${vote.area}.json`)}.`;
}

/** Proposals for every unplaced or not-yet-placed file. Exported for tests. */
export function proposeHomes(root, { files, placement }) {
  const fileSet = new Set(files);
  const waiting = files.filter((file) => placement[file] === "(unplaced)" || placement[file] === "(not yet placed)");
  const candidates = waiting.filter((file) => CANDIDATE.test(file));
  const proposals = candidates.map((file) => {
    const status = placement[file] === "(unplaced)" ? "unplaced" : "not yet placed";
    if (!CODE_FILE.test(file))
      return { file, status, outcome: { reason: "it is not a JavaScript or TypeScript file" } };
    let imports;
    try {
      imports = localImports(root, file, fileSet);
    } catch {
      return { file, status, outcome: { reason: "its imports could not be read" } };
    }
    return { file, status, imports, outcome: { vote: voteForHome(file, imports, placement) } };
  });
  return { proposals, others: waiting.length - candidates.length };
}

export function renderSuggestedHomes({ proposals, others }) {
  const lines = [
    "Proposals only: nothing is moved and no map file is changed. For each unplaced or not-yet-placed test or script, the area most of its local imports belong to, shown as a vote. To accept one, add the line shown, then run `npm run check:organisation -- --fix`, which sorts the rules and drops the matching not-yet-placed entry.",
    "",
  ];
  if (!proposals.length) lines.push("No unplaced or not-yet-placed tests or scripts this week.");
  for (const proposal of proposals.slice(0, LIST_MAX))
    lines.push(describe(proposal.file, proposal.status, proposal.outcome));
  if (proposals.length > LIST_MAX) lines.push(`- …and ${proposals.length - LIST_MAX} more.`);
  if (others > 0) {
    lines.push(
      "",
      `${plural(others, "other waiting file")} (not a test or script) ${others === 1 ? "gets" : "get"} no suggestion; the map hygiene section lists ${others === 1 ? "it" : "them"}.`,
    );
  }
  return lines.join("\n");
}

export async function section({ root }) {
  return { title: "Suggested homes", markdown: renderSuggestedHomes(proposeHomes(root, loadPlacement(root))) };
}
