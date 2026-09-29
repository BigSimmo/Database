/**
 * The title grammar editors use to file hospital handbook entries, with no
 * database change (plan correction C7; owner Q10).
 *
 * Handbook content has no category, team or sort field. Editors write a visible
 * prefix instead — `Ward: 4B`, `ICU: Registrar`, `Emergency: Medical emergency
 * team` — and it is parsed here, in one place, matched without regard to case.
 *
 *  - Five prefixes are categories: Emergency, Ward, Access, Equipment, Downtime.
 *    `Access` stays in the grammar so on-site items (access, parking, food,
 *    taxi, security) are recognised and left to Admin (owner 16:06Z).
 *  - **Any other prefix is a team** (review F10). "Orthopaedics: Registrar"
 *    files under Orthopaedics; nothing is misfiled for want of a list entry.
 *    `ON_CALL_TEAMS` only orders the common teams first and merges names that
 *    mean the same team ("Paeds" and "Paediatrics"). The editor's preview
 *    (lane C) names where an entry will appear and warns about a prefix it has
 *    not seen, so a typo is caught by a person rather than guessed at here.
 *  - A title that does not start with a word and a colon has no prefix, and the
 *    whole title stays the label. No text is ever dropped.
 *
 * Two body lines are read too: `Also known as: HDU, high dependency` (aliases,
 * searched like the title) and `From a mobile: 9000 0000, 55` (the route from a
 * mobile beside a number only a hospital phone can dial; review F1).
 */

export const HANDBOOK_TITLE_PREFIXES = ["Emergency", "Ward", "Access", "Equipment", "Downtime"] as const;
export type HandbookTitlePrefix = (typeof HANDBOOK_TITLE_PREFIXES)[number];

/** The common teams, in the order Who's on and Now list them. Not a closed list. */
export const ON_CALL_TEAMS = [
  "Medicine",
  "Surgery",
  "ED",
  "ICU",
  "Paediatrics",
  "Obstetrics",
  "Anaesthetics",
  "Psychiatry",
  "After-hours manager",
] as const;
export type KnownOnCallTeam = (typeof ON_CALL_TEAMS)[number];
/** Any team an editor writes as a prefix (review F10, correction C26). */
export type OnCallTeam = string;

/** One word each for the 48px tab bar. Teams not listed use their own name. */
export const ON_CALL_TEAM_BAR_LABELS: Readonly<Record<KnownOnCallTeam, string>> = {
  Medicine: "Medicine",
  Surgery: "Surgery",
  ED: "ED",
  ICU: "ICU",
  Paediatrics: "Paeds",
  Obstetrics: "Obstetrics",
  Anaesthetics: "Anaesthetics",
  Psychiatry: "Psychiatry",
  "After-hours manager": "Manager",
};

/**
 * Names that mean the same team. This list only MERGES names; it never decides
 * whether a prefix is a team. Keys are lower case with single spaces.
 */
const TEAM_SYNONYMS: Readonly<Record<string, KnownOnCallTeam>> = {
  medicine: "Medicine",
  "gen med": "Medicine",
  "general medicine": "Medicine",
  surgery: "Surgery",
  "gen surg": "Surgery",
  "general surgery": "Surgery",
  ed: "ED",
  "emergency department": "ED",
  "emergency dept": "ED",
  icu: "ICU",
  "intensive care": "ICU",
  "intensive care unit": "ICU",
  paediatrics: "Paediatrics",
  paeds: "Paediatrics",
  pediatrics: "Paediatrics",
  peds: "Paediatrics",
  obstetrics: "Obstetrics",
  "o&g": "Obstetrics",
  obs: "Obstetrics",
  "obstetrics and gynaecology": "Obstetrics",
  anaesthetics: "Anaesthetics",
  anaesthesia: "Anaesthetics",
  anesthesia: "Anaesthetics",
  anesthetics: "Anaesthetics",
  psychiatry: "Psychiatry",
  psych: "Psychiatry",
  "mental health": "Psychiatry",
  "after-hours manager": "After-hours manager",
  "after hours manager": "After-hours manager",
  "after-hours hospital manager": "After-hours manager",
};

export type ParsedHandbookTitle = {
  readonly prefix: HandbookTitlePrefix | null;
  readonly team: OnCallTeam | null;
  readonly label: string;
};

/**
 * A prefix is a word or short phrase: letters, spaces, `&`, `/`, `'` and `-`,
 * starting with a letter, then a colon and the label. "Handover at 08:00" and
 * "4B: side room" therefore have no prefix.
 */
const PREFIXED_TITLE = /^\s*([A-Za-z][A-Za-z&/'’ -]{0,39}?)\s*:\s*(\S.*)$/;

function canonicalTeam(raw: string): OnCallTeam {
  const spaced = raw.trim().replace(/\s+/g, " ");
  const known = TEAM_SYNONYMS[spaced.toLowerCase()];
  if (known) return known;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function parseHandbookTitle(title: string): ParsedHandbookTitle {
  const whole = title.trim();
  const match = PREFIXED_TITLE.exec(whole);
  if (!match) return { prefix: null, team: null, label: whole };
  const [, rawPrefix, label] = match;
  const prefix = HANDBOOK_TITLE_PREFIXES.find((candidate) => candidate.toLowerCase() === rawPrefix.toLowerCase());
  if (prefix) return { prefix, team: null, label: label.trim() };
  return { prefix: null, team: canonicalTeam(rawPrefix), label: label.trim() };
}

/** The one-word tab label for a team. */
export function onCallTeamBarLabel(team: OnCallTeam): string {
  return (ON_CALL_TEAM_BAR_LABELS as Readonly<Record<string, string>>)[team] ?? team;
}

/** Common teams in `ON_CALL_TEAMS` order, then any other team by name. */
export function compareOnCallTeams(a: OnCallTeam, b: OnCallTeam): number {
  const order = ON_CALL_TEAMS as readonly string[];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  return a.localeCompare(b);
}

function bodyLine(body: string, label: RegExp): string | null {
  for (const line of body.split(/\r?\n/)) {
    const match = label.exec(line);
    if (match) return match[1].trim() || null;
  }
  return null;
}

/** The names on the one `Also known as:` line, which must start its own line. */
export function handbookAliases(body: string): string[] {
  const line = bodyLine(body, /^\s*Also known as:\s*(.*)$/);
  if (!line) return [];
  return line
    .split(",")
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

/** The raw route recorded on a `From a mobile:` line, or null. */
export function handbookMobileRoute(body: string): string | null {
  return bodyLine(body, /^\s*From a mobile:\s*(.*)$/i);
}
