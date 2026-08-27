#!/usr/bin/env node
/**
 * check:ward-data — reads the Ward Flow prototype's changeable data and says, in plain words,
 * anything that does not add up.
 *
 * WHO THIS IS FOR. The person who edits this data is a psychiatrist replacing invented bed
 * numbers with real ones, and later adding hospitals and wards as the real world changes. He is
 * not going to read a stack trace. So every message below names the file to edit, the values as
 * they are written today, the arithmetic that failed, and the choices available — never
 * "invariant violated", never a bare `expected [] to deep equal []`.
 *
 * WHY IT EXISTS AT ALL. Most of this data is checked by nothing. `Unit.sexMix` is a
 * hand-maintained pair of counts; `HealthService` is a bare type union with no runtime array, so a
 * hospital in a new service compiles clean and then silently vanishes from the network map and
 * the ED screen; `SYNTHETIC_TRAVEL_BANDS` is keyed on plain `string` site codes that nothing
 * validates; nav labels hardcode ward names that nothing compares against the ward.
 *
 * READ-ONLY AND OFFLINE. It reads source files, writes nothing, and touches no network, provider
 * or database.
 *
 * HOW IT READS THE DATA. Most facts are IMPORTED from the real TypeScript modules (re-running
 * this file under `tsx`), so the checks run against the same values the app runs against, using
 * the app's own `unitCapacity` and `bedIsOccupied` functions rather than a second copy of their
 * arithmetic. Two facts cannot be imported because they are module-local constants inside React
 * component files, and those two are read by TEXT PARSE (`columnServices` in
 * ward-management-network.tsx, and the tour ids in morning/morning-tour.tsx). A text parse can
 * drift from the real code, so both parses FAIL LOUDLY when the shape they expect is not found —
 * they never quietly report "nothing to check".
 *
 * Run it with:  node scripts/check-ward-data.mjs
 * Exit code 0 = everything adds up. Exit code 1 = at least one problem, all of them printed.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** Repository-relative paths, written out once so every message names the same file the same way. */
export const FILES = {
  sites: "src/components/ward-management/ward-sites.ts",
  seed: "src/components/ward-management/ward-admissions-seed.ts",
  model: "src/components/ward-management/ward-model.ts",
  teams: "src/components/ward-management/ward-teams.ts",
  travel: "src/components/ward-management/ward-travel-bands.ts",
  derivations: "src/components/ward-management/ward-derivations.ts",
  network: "src/components/ward-management/ward-management-network.tsx",
  nav: "src/components/ward-management/ward-nav.ts",
  tour: "src/components/ward-management/morning/morning-tour.tsx",
};

// ---------------------------------------------------------------------------------------------
// Small helpers. Nothing here knows about wards; they only make the messages read like English.
// ---------------------------------------------------------------------------------------------

/** "1 bed" / "3 beds" — a message that says "1 beds" reads as a bug in the checker. */
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "A, B and C" — the list form a reader can scan, not a JSON array. */
function listOut(values) {
  const items = [...values];
  if (items.length === 0) return "(none)";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The closest id in `candidates` to `value`, or null when nothing is close.
 *
 * This exists purely so a typo'd ward id gets "did you mean rph-adult-secure?" instead of a bare
 * "not found". Plain Levenshtein distance, capped at a third of the id's length so an unrelated
 * id is never offered as a suggestion — a wrong suggestion is worse than none.
 */
export function closestMatch(value, candidates) {
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(value, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  const limit = Math.max(2, Math.floor(value.length / 3));
  return best !== null && bestDistance <= limit ? best : null;
}

function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

/**
 * One problem, rendered.
 *
 * `title` names the thing that is wrong; `lines` explain it and end with what to do. `text` is the
 * whole thing already indented, because that is what the tests assert against — a test that only
 * asserted "a problem was found" would pass just as happily on an unreadable message.
 */
function problem(id, title, lines) {
  return { id, title, lines, text: [title, ...lines.map((line) => `  ${line}`)].join("\n") };
}

/** How a unit is named at the top of a message: the ward, its id, and the hospital it sits in. */
function unitHeading(unit, site) {
  const where = site ? ` at ${site.name}` : "";
  return `${unit.name} (${unit.id})${where}`;
}

// ---------------------------------------------------------------------------------------------
// The checks. Every one of these is a pure function of data handed in, so each can be driven red
// from a constructed fixture in tests/ward-data-checker.test.ts without editing any real file.
// ---------------------------------------------------------------------------------------------

/**
 * Check 1 — the bed numbers on each ward add up.
 *
 * The binding identity is `unitCapacity()` in ward-derivations.ts: `available + held + blocked +
 * occupied === beds`, where `available`/`held` are split out of the empty pool and
 * `blocked`/`occupied` out of the rest. That function CLAMPS every split, which is the reason this
 * check exists: clamped arithmetic cannot produce a crash or a wrong total, it silently shows a
 * different number from the one that was typed. So the check looks for the four ways authored data
 * can be quietly overruled, and separately for the one way the partition really can break
 * (`empty` larger than `beds`).
 *
 * `unitCapacity` is INJECTED rather than reimplemented here: a second copy of the formula would
 * agree with itself forever while drifting from the app.
 */
export function checkBedArithmetic({ sites, unitCapacity }) {
  const problems = [];
  for (const site of sites) {
    for (const unit of site.units ?? []) {
      const heading = unitHeading(unit, site);
      const beds = unit.beds;
      const empty = unit.empty?.value;
      const allocatable = unit.allocatable?.value;
      const blocked = unit.blocked;

      for (const [label, value] of [
        ["beds", beds],
        ["empty", empty],
        ["allocatable", allocatable],
        ["blocked", blocked],
      ]) {
        if (!Number.isInteger(value) || value < 0) {
          problems.push(
            problem("bed-number-not-a-whole-number", heading, [
              `${label} is ${JSON.stringify(value)}, which is not a whole number of beds.`,
              `Every bed figure has to be 0 or more, with no decimal point.`,
              `File to edit: ${FILES.sites}`,
            ]),
          );
        }
      }
      if (
        ![beds, empty, allocatable, blocked].every((value) => Number.isInteger(value) && value >= 0)
      ) {
        continue;
      }

      if (empty > beds) {
        problems.push(
          problem("more-empty-beds-than-beds", heading, [
            `empty says ${plural(empty, "bed")}, but the ward only has ${plural(beds, "bed")}.`,
            `A ward cannot have more empty beds than beds.`,
            `To fix, either:`,
            `  - lower empty to ${beds} or less, or`,
            `  - raise beds to at least ${empty}`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
      }

      if (allocatable > empty) {
        problems.push(
          problem("allocatable-more-than-empty", heading, [
            `allocatable says ${plural(allocatable, "bed")} can be offered, but only ${plural(empty, "bed")} ${empty === 1 ? "is" : "are"} empty.`,
            `The screens will quietly show ${empty}, not ${allocatable} — the extra ${allocatable - empty} is ignored, with no warning anywhere.`,
            `To fix, either:`,
            `  - lower allocatable to ${empty} or less, or`,
            `  - raise empty to ${allocatable} if that many really are free`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
      }

      const notEmpty = Math.max(beds - empty, 0);
      if (blocked > notEmpty) {
        problems.push(
          problem("blocked-more-than-occupiable", heading, [
            `blocked says ${plural(blocked, "bed")} out of service, but only ${plural(notEmpty, "bed")} ${notEmpty === 1 ? "is" : "are"} not already counted as empty.`,
            `The screens will quietly show ${notEmpty}, not ${blocked} — the extra ${blocked - notEmpty} is ignored.`,
            `To fix, either:`,
            `  - lower blocked to ${notEmpty} or less, or`,
            `  - lower empty, since a bed cannot be empty and out of service at the same time`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
      }

      const capacity = unitCapacity(unit, []);
      const partition = capacity.available + capacity.held + capacity.blocked + capacity.occupied;
      if (partition !== beds) {
        problems.push(
          problem("bed-states-do-not-add-up-to-beds", heading, [
            `beds says ${beds}, but the five bed states add up to ${partition}.`,
            `  ${capacity.available} ready + ${capacity.held} held + ${capacity.blocked} out of service + ${capacity.occupied} with someone in them = ${partition}`,
            `Every bed has to be in exactly one of those states.`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
      }

      const women = unit.sexMix?.Female;
      const men = unit.sexMix?.Male;
      if (!Number.isInteger(women) || !Number.isInteger(men) || women < 0 || men < 0) {
        problems.push(
          problem("sex-mix-not-whole-numbers", heading, [
            `the male/female split is ${JSON.stringify(unit.sexMix)}, which is not two whole numbers of people.`,
            `It has to read like  sexMix: { Female: 9, Male: 9 }.`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
        continue;
      }

      const people = women + men;
      if (people !== capacity.occupied) {
        const short = capacity.occupied - people;
        problems.push(
          problem("sex-mix-does-not-match-occupied-beds", heading, [
            `beds says ${beds}, but the parts only add up to ${people + empty + capacity.blocked}.`,
            `  ${people} with someone in them + ${empty} empty + ${capacity.blocked} out of service = ${people + empty + capacity.blocked}`,
            `To fix, either:`,
            `  - change beds to ${people + empty + capacity.blocked}, or`,
            `  - update the male/female split (currently ${women} female + ${men} male = ${people})`,
            short > 0
              ? `    so it adds up to ${capacity.occupied}, and add ${plural(short, "more occupant", "more occupants")} for this ward in ${FILES.seed}`
              : `    so it adds up to ${capacity.occupied}, and remove ${plural(-short, "occupant")} for this ward from ${FILES.seed}`,
            `File to edit: ${FILES.sites}`,
          ]),
        );
      }
    }
  }
  return problems;
}

/**
 * Check 2 — the people listed in the seed match each ward's recorded male/female split, per sex.
 *
 * Same rule and same counting function as `tests/ward-admissions-seed.test.ts`: an admission
 * counts when `bedIsOccupied` says so, which includes `"pulled"` (the bed is gone from the pull,
 * even though nobody has arrived yet). `bedIsOccupied` is injected for the same reason
 * `unitCapacity` is — so this never becomes a second, drifting copy of the rule.
 *
 * Check 3 (nobody is squeezed into a ward with too few beds) is folded in here, because it is the
 * same count answering a different question.
 */
export function checkSeededOccupants({ sites, admissions, bedIsOccupied }) {
  const problems = [];
  const units = sites.flatMap((site) => (site.units ?? []).map((unit) => ({ unit, site })));
  const knownUnitIds = new Set(units.map((entry) => entry.unit.id));

  for (const { unit, site } of units) {
    const here = admissions.filter(
      (admission) => admission.unitId === unit.id && bedIsOccupied(admission),
    );
    const seeded = {
      Female: here.filter((admission) => admission.sex === "Female").length,
      Male: here.filter((admission) => admission.sex === "Male").length,
    };
    const recorded = { Female: unit.sexMix?.Female, Male: unit.sexMix?.Male };
    const heading = unitHeading(unit, site);

    const wrongSexes = ["Female", "Male"].filter((sex) => seeded[sex] !== recorded[sex]);
    if (wrongSexes.length > 0) {
      const lines = [`the people listed for this ward do not match its male/female split.`];
      for (const sex of ["Female", "Male"]) {
        const word = sex.toLowerCase();
        lines.push(
          seeded[sex] === recorded[sex]
            ? `  ${word}: ${recorded[sex]} recorded, ${seeded[sex]} listed — these agree`
            : `  ${word}: ward-sites.ts says ${recorded[sex]}, ward-admissions-seed.ts lists ${seeded[sex]}`,
        );
      }
      lines.push(`To fix, either:`);
      for (const sex of wrongSexes) {
        const gap = recorded[sex] - seeded[sex];
        const word = sex.toLowerCase();
        lines.push(
          gap > 0
            ? `  - add ${plural(gap, `more ${word} occupant`, `more ${word} occupants`)} for this ward in ${FILES.seed}, or`
            : `  - remove ${plural(-gap, `${word} occupant`)} for this ward from ${FILES.seed}, or`,
        );
      }
      lines.push(
        `  - change sexMix to { Female: ${seeded.Female}, Male: ${seeded.Male} } in ${FILES.sites}`,
        `    (if you do that, check the bed totals for this ward still add up)`,
      );
      problems.push(problem("seeded-people-do-not-match-sex-mix", heading, lines));
    }

    if (Number.isInteger(unit.beds) && here.length > unit.beds) {
      problems.push(
        problem("more-people-than-beds", heading, [
          `${plural(here.length, "person", "people")} ${here.length === 1 ? "is" : "are"} listed in this ward's beds, but it only has ${plural(unit.beds, "bed")}.`,
          `To fix, either:`,
          `  - remove ${plural(here.length - unit.beds, "occupant")} for this ward from ${FILES.seed}, or`,
          `  - raise beds to at least ${here.length} in ${FILES.sites}`,
        ]),
      );
    }
  }

  // A ward id that was renamed leaves its occupants behind, and the ward silently reads as empty.
  const orphans = new Map();
  for (const admission of admissions) {
    if (knownUnitIds.has(admission.unitId)) continue;
    if (!orphans.has(admission.unitId)) orphans.set(admission.unitId, []);
    orphans.get(admission.unitId).push(admission.id);
  }
  for (const [unitId, ids] of orphans) {
    const suggestion = closestMatch(unitId, [...knownUnitIds]);
    problems.push(
      problem("people-listed-for-a-ward-that-does-not-exist", `Ward id "${unitId}"`, [
        `${plural(ids.length, "person", "people")} in ${FILES.seed} ${ids.length === 1 ? "is" : "are"} listed in a ward called "${unitId}", but there is no ward with that id.`,
        `Affected entries: ${listOut(ids.slice(0, 5))}${ids.length > 5 ? `, and ${ids.length - 5} more` : ""}`,
        suggestion ? `Did you mean "${suggestion}"?` : `No existing ward id looks close to that one.`,
        `Those people are invisible everywhere in the app, and the ward they should be in reads as emptier than it is.`,
        `To fix, either:`,
        `  - correct the unitId on those entries in ${FILES.seed}, or`,
        `  - add a ward with the id "${unitId}" in ${FILES.sites}`,
      ]),
    );
  }
  return problems;
}

/**
 * Check 4 — the travel-time table only names hospitals and regions that exist.
 *
 * The site level of `SYNTHETIC_TRAVEL_BANDS` is keyed on plain `string` (`Partial<Record<string,
 * TravelBand>>`), so a typo'd hospital code compiles perfectly and then simply never matches
 * anything — the pair reads as "not recorded" forever, which is a legitimate value here, so
 * nothing downstream can tell the difference. The region level IS typed, but is checked too so
 * the message is a sentence rather than a compiler error.
 */
export function checkTravelBands({ sites, travelBands, homeRegions, travelBandNames }) {
  const problems = [];
  const siteCodes = sites.map((site) => site.code);
  const knownCodes = new Set(siteCodes);
  const knownRegions = new Set(homeRegions);
  const knownBands = new Set(travelBandNames);

  for (const [region, bySite] of Object.entries(travelBands ?? {})) {
    if (!knownRegions.has(region)) {
      const suggestion = closestMatch(region, [...knownRegions]);
      problems.push(
        problem("travel-times-name-an-unknown-region", `Travel times: region "${region}"`, [
          `${FILES.travel} records travel times for a region called "${region}", but that is not one of the regions the app knows about.`,
          suggestion ? `Did you mean "${suggestion}"?` : `The regions are: ${listOut(homeRegions)}.`,
          `Every travel time recorded under it is ignored.`,
          `To fix, either:`,
          `  - correct the region name in ${FILES.travel}, or`,
          `  - add "${region}" to HOME_REGIONS in ${FILES.model}`,
        ]),
      );
      continue;
    }
    for (const [code, band] of Object.entries(bySite ?? {})) {
      if (!knownCodes.has(code)) {
        const suggestion = closestMatch(code, siteCodes);
        problems.push(
          problem(
            "travel-times-name-an-unknown-hospital",
            `Travel times: hospital code "${code}" (under ${region})`,
            [
              `${FILES.travel} records a travel time to a hospital with the code "${code}", but no hospital in ${FILES.sites} has that code.`,
              suggestion
                ? `Did you mean "${suggestion}"?`
                : `The hospital codes are: ${listOut(siteCodes)}.`,
              `Nothing shows an error for this — the pair just reads as "travel time not recorded", forever.`,
              `To fix, either:`,
              `  - correct the code in ${FILES.travel}, or`,
              `  - add that hospital to ${FILES.sites}`,
            ],
          ),
        );
        continue;
      }
      if (!knownBands.has(band)) {
        problems.push(
          problem(
            "travel-times-use-an-unknown-band",
            `Travel times: ${region} to ${code}`,
            [
              `the travel time is written as "${band}", which is not one of the four bands the app uses.`,
              `The four are: ${listOut(travelBandNames)}.`,
              `To fix: change it to one of those four in ${FILES.travel}`,
            ],
          ),
        );
      }
    }
  }
  return problems;
}

/**
 * Check 5 — every region a person can come from has a community mental health team.
 *
 * `COMMUNITY_TEAMS` is typed `Record<HomeRegion, string>`, so a MISSING region already fails
 * typecheck. This checks it anyway, in words, because a typecheck error is not a sentence a
 * non-engineer can act on — and it additionally catches the two things the type cannot see: a
 * blank team name, and a leftover entry for a region that no longer exists.
 */
export function checkCommunityTeams({ homeRegions, communityTeams }) {
  const problems = [];
  for (const region of homeRegions) {
    const team = communityTeams?.[region];
    if (typeof team !== "string" || team.trim() === "") {
      problems.push(
        problem("region-has-no-community-team", `Region "${region}"`, [
          `has no community mental health team recorded.`,
          `The ward board uses this to say where somebody goes back to when they are discharged, so for anyone from ${region} it will have nothing to show.`,
          `To fix: add a line to COMMUNITY_TEAMS in ${FILES.teams}, like`,
          `  "${region}": "${region} Community Mental Health Team (placeholder)",`,
        ]),
      );
    }
  }
  for (const region of Object.keys(communityTeams ?? {})) {
    if (homeRegions.includes(region)) continue;
    problems.push(
      problem("community-team-for-an-unknown-region", `Region "${region}"`, [
        `has a community mental health team in ${FILES.teams}, but "${region}" is not one of the regions in HOME_REGIONS (${FILES.model}).`,
        `That team is never shown to anybody.`,
        `To fix, either:`,
        `  - remove the entry from ${FILES.teams}, or`,
        `  - add "${region}" to HOME_REGIONS in ${FILES.model}`,
      ]),
    );
  }
  return problems;
}

/**
 * Check 6 — every health service a hospital uses appears in BOTH hand-written display lists.
 *
 * This is the one with no compiler behind it at all. `HealthService` (ward-model.ts) is a bare
 * type union with no runtime array, and both display lists are hand-written arrays typed
 * `HealthService[]` — adding a member to the union does not make either array fail to compile.
 * So a hospital in a new service typechecks, builds, and then:
 *   - `wardServiceOrder` (ward-derivations.ts) is what the ED screen's ward table and the
 *     coordinator flow diagram iterate, so its wards are dropped from both;
 *   - `columnServices` (ward-management-network.tsx) is what draws the two columns of the network
 *     map, so no column is ever drawn for them.
 * Nothing anywhere says a word about it.
 */
export function checkHealthServiceLists({ sites, serviceOrder, columnServices }) {
  const problems = [];
  const columnMembers = [...(columnServices?.left ?? []), ...(columnServices?.right ?? [])];
  const inOrder = new Set(serviceOrder ?? []);
  const inColumns = new Set(columnMembers);

  const usedBy = new Map();
  for (const site of sites) {
    if (!usedBy.has(site.service)) usedBy.set(site.service, []);
    usedBy.get(site.service).push(`${site.name} (${site.code})`);
  }

  for (const [service, hospitals] of usedBy) {
    const missing = [];
    if (!inOrder.has(service)) {
      missing.push({
        list: `wardServiceOrder in ${FILES.derivations}`,
        effect: `the ED screen's ward table and the coordinator flow diagram will skip these wards entirely`,
      });
    }
    if (!inColumns.has(service)) {
      missing.push({
        list: `columnServices in ${FILES.network}`,
        effect: `the network map will never draw a column for these wards, so they do not appear on it at all`,
      });
    }
    if (missing.length === 0) continue;

    const lines = [
      `${plural(hospitals.length, "hospital")} ${hospitals.length === 1 ? "uses" : "use"} the health service "${service}", but it is missing from ${plural(missing.length, "of the lists that decide what the screens show", "of the lists that decide what the screens show")}.`,
      `Hospitals affected: ${listOut(hospitals)}`,
      `Missing from:`,
    ];
    for (const entry of missing) {
      lines.push(`  - ${entry.list}`);
      lines.push(`    Without it, ${entry.effect}.`);
    }
    lines.push(
      `Nothing else warns about this: the app compiles and runs perfectly with these wards invisible.`,
      `To fix: add "${service}" to ${missing.length === 1 ? "that list" : "both lists"}.`,
    );
    problems.push(problem("health-service-missing-from-a-screen-list", `Health service "${service}"`, lines));
  }

  for (const service of new Set([...inOrder, ...inColumns])) {
    if (usedBy.has(service)) continue;
    problems.push(
      problem("health-service-with-no-hospitals", `Health service "${service}"`, [
        `is listed as a health service the screens should show, but no hospital in ${FILES.sites} belongs to it.`,
        `The network map will draw an empty column headed "${service.toUpperCase()}".`,
        `To fix, either:`,
        `  - remove "${service}" from ${inOrder.has(service) ? `wardServiceOrder (${FILES.derivations})` : ""}${inOrder.has(service) && inColumns.has(service) ? " and " : ""}${inColumns.has(service) ? `columnServices (${FILES.network})` : ""}, or`,
        `  - give a hospital that service in ${FILES.sites}`,
      ]),
    );
  }

  const seen = new Set();
  for (const service of columnMembers) {
    if (seen.has(service)) {
      problems.push(
        problem("health-service-listed-twice-on-the-map", `Health service "${service}"`, [
          `appears more than once in columnServices (${FILES.network}).`,
          `The network map will draw two columns for the same wards.`,
          `To fix: remove the duplicate in ${FILES.network}`,
        ]),
      );
    }
    seen.add(service);
  }
  return problems;
}

/**
 * Check 7 — every ward or department id named outside the seed points at something real.
 *
 * The nav rail hardcodes example links into the dynamic routes (`ward/[unitId]`, `ed/[edId]`), and
 * the morning tour hardcodes the ward and department it walks through. Rename a ward id in
 * ward-sites.ts and those become links to a "not found" page, or a tour that does nothing — with
 * no build error, because a route parameter is just a string.
 *
 * Check 8 (a nav label naming the wrong ward) is folded in here: it is the same reference, asked a
 * second question.
 */
export function checkUnitReferences({ sites, unitReferences, edReferences }) {
  const problems = [];
  const units = new Map();
  for (const site of sites) for (const unit of site.units ?? []) units.set(unit.id, unit);
  const departments = new Map();
  for (const site of sites) {
    if (site.emergencyDepartment) departments.set(site.emergencyDepartment.id, site.emergencyDepartment);
  }

  for (const reference of unitReferences ?? []) {
    const unit = units.get(reference.unitId);
    if (!unit) {
      const suggestion = closestMatch(reference.unitId, [...units.keys()]);
      problems.push(
        problem("link-to-a-ward-that-does-not-exist", `${reference.where}: ward "${reference.unitId}"`, [
          `${reference.detail} points at a ward with the id "${reference.unitId}", but there is no ward with that id in ${FILES.sites}.`,
          suggestion
            ? `Did you mean "${suggestion}" (${units.get(suggestion).name})?`
            : `No existing ward id looks close to that one.`,
          `Anyone following it lands on a "not found" page.`,
          `To fix, either:`,
          `  - correct the id in ${reference.file}, or`,
          `  - restore that ward in ${FILES.sites}`,
        ]),
      );
      continue;
    }
    // Check 8: the label claims a ward name, so compare it against the ward's real name.
    if (typeof reference.label === "string" && reference.label.includes(" — ")) {
      const claimed = reference.label.slice(reference.label.lastIndexOf(" — ") + 3).trim();
      if (claimed !== unit.name) {
        problems.push(
          problem("menu-label-names-the-wrong-ward", `${reference.where}: menu item "${reference.label}"`, [
            `the menu says this link goes to "${claimed}", but the ward it actually opens is called "${unit.name}".`,
            `Link: ${reference.detail}`,
            `The menu is wrong, not the link — nothing checks the two against each other, so the menu will keep saying the old name.`,
            `To fix: change the label in ${reference.file} to`,
            `  "${reference.label.slice(0, reference.label.lastIndexOf(" — "))} — ${unit.name}"`,
          ]),
        );
      }
    }
  }

  for (const reference of edReferences ?? []) {
    if (departments.has(reference.edId)) continue;
    const suggestion = closestMatch(reference.edId, [...departments.keys()]);
    problems.push(
      problem(
        "link-to-an-emergency-department-that-does-not-exist",
        `${reference.where}: emergency department "${reference.edId}"`,
        [
          `${reference.detail} points at an emergency department with the id "${reference.edId}", but no hospital in ${FILES.sites} has one with that id.`,
          suggestion
            ? `Did you mean "${suggestion}" (${departments.get(suggestion).name})?`
            : `No existing department id looks close to that one.`,
          `Anyone following it lands on a "not found" page.`,
          `To fix, either:`,
          `  - correct the id in ${reference.file}, or`,
          `  - restore that department in ${FILES.sites}`,
        ],
      ),
    );
  }
  return problems;
}

/**
 * Check 9 (added, not in the original list) — the network's own ids and nesting are coherent.
 *
 * Added because the product owner's stated workflow is "add hospitals and wards as the real world
 * changes", and in this file that means copying an existing block and editing it. The two mistakes
 * that workflow actually produces are a duplicated id and a `siteCode` left pointing at the
 * hospital the block was copied from. Both are silent: `unitById`/`siteByCode` return the first
 * match, so a duplicated ward is simply invisible; and a ward whose `siteCode` names a different
 * hospital is grouped, mapped, columned and travel-timed as though it belonged to that other
 * hospital, while still being listed under this one. Neither is a type error.
 */
export function checkNetworkShape({ sites }) {
  const problems = [];

  const seenSiteCodes = new Map();
  for (const site of sites) {
    if (seenSiteCodes.has(site.code)) {
      problems.push(
        problem("two-hospitals-share-a-code", `Hospital code "${site.code}"`, [
          `is used by two hospitals: ${seenSiteCodes.get(site.code)} and ${site.name}.`,
          `A code has to be unique. Only the first is ever found, so the second is invisible everywhere in the app.`,
          `To fix: give one of them a different code in ${FILES.sites}`,
        ]),
      );
    }
    seenSiteCodes.set(site.code, site.name);
  }

  const seenUnitIds = new Map();
  const seenEdIds = new Map();
  for (const site of sites) {
    const ed = site.emergencyDepartment;
    if (ed) {
      if (seenEdIds.has(ed.id)) {
        problems.push(
          problem("two-departments-share-an-id", `Emergency department id "${ed.id}"`, [
            `is used twice: ${seenEdIds.get(ed.id)} and ${ed.name}.`,
            `Only the first is ever found, so the second is invisible everywhere in the app.`,
            `To fix: give one of them a different id in ${FILES.sites}`,
          ]),
        );
      }
      seenEdIds.set(ed.id, ed.name);
      if (ed.siteCode !== site.code) {
        problems.push(
          problem("department-is-filed-under-the-wrong-hospital", `${ed.name} (${ed.id})`, [
            `is listed inside ${site.name}, whose code is "${site.code}", but its own siteCode says "${ed.siteCode}".`,
            `The app believes this department belongs to a different hospital from the one it is written under.`,
            `To fix: change siteCode to "${site.code}" in ${FILES.sites}`,
          ]),
        );
      }
    }

    for (const unit of site.units ?? []) {
      if (seenUnitIds.has(unit.id)) {
        problems.push(
          problem("two-wards-share-an-id", `Ward id "${unit.id}"`, [
            `is used by two wards: ${seenUnitIds.get(unit.id)} and ${unit.name}.`,
            `An id has to be unique. Only the first is ever found, so the second is invisible everywhere in the app — it will not appear on the map, in the ward list, or at its own web address.`,
            `This is what happens when a ward is added by copying an existing one and the id is not changed.`,
            `To fix: give one of them a different id in ${FILES.sites}`,
          ]),
        );
      }
      seenUnitIds.set(unit.id, unit.name);

      if (unit.siteCode !== site.code) {
        const owner = sites.find((candidate) => candidate.code === unit.siteCode);
        problems.push(
          problem("ward-is-filed-under-the-wrong-hospital", unitHeading(unit, site), [
            `is written under ${site.name}, whose code is "${site.code}", but its own siteCode says "${unit.siteCode}".`,
            owner
              ? `So the app treats this ward as belonging to ${owner.name} (${owner.service}) — it will appear under that hospital on the network map, and travel times will be measured to it.`
              : `And "${unit.siteCode}" is not the code of any hospital, so this ward has no hospital at all: it disappears from the network map and every health-service grouping.`,
            `This is what happens when a ward is added by copying one from another hospital.`,
            `To fix: change siteCode to "${site.code}" in ${FILES.sites}`,
          ]),
        );
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Running every check, and reporting.
// ---------------------------------------------------------------------------------------------

/**
 * Runs every check against data handed in, and returns the problems plus what was counted.
 *
 * Everything is a parameter. That is deliberate: it is what lets each rule be driven red from a
 * constructed fixture in tests/ward-data-checker.test.ts, without touching a single real file — a
 * checker whose failure path has never been executed is not a checker.
 */
export function checkWardData(data) {
  const sites = data.sites ?? [];
  const admissions = data.admissions ?? [];
  const problems = [
    ...checkNetworkShape({ sites }),
    ...checkBedArithmetic({ sites, unitCapacity: data.unitCapacity }),
    ...checkSeededOccupants({ sites, admissions, bedIsOccupied: data.bedIsOccupied }),
    ...checkTravelBands({
      sites,
      travelBands: data.travelBands,
      homeRegions: data.homeRegions ?? [],
      travelBandNames: data.travelBandNames ?? [],
    }),
    ...checkCommunityTeams({
      homeRegions: data.homeRegions ?? [],
      communityTeams: data.communityTeams ?? {},
    }),
    ...checkHealthServiceLists({
      sites,
      serviceOrder: data.serviceOrder ?? [],
      columnServices: data.columnServices ?? { left: [], right: [] },
    }),
    ...checkUnitReferences({
      sites,
      unitReferences: data.unitReferences ?? [],
      edReferences: data.edReferences ?? [],
    }),
    ...(data.readingProblems ?? []),
  ];
  return {
    problems,
    counts: {
      hospitals: sites.length,
      wards: sites.reduce((total, site) => total + (site.units?.length ?? 0), 0),
      people: admissions.length,
      references: (data.unitReferences ?? []).length + (data.edReferences ?? []).length,
    },
  };
}

/** The whole report as text — the summary line is printed whether or not anything is wrong. */
export function formatReport(result) {
  const { counts, problems } = result;
  const summary =
    `check:ward-data — ${plural(counts.hospitals, "hospital")}, ${plural(counts.wards, "ward")}, ` +
    `${plural(counts.people, "person", "people")} and ${plural(counts.references, "link")} checked. ` +
    (problems.length === 0 ? `No problems found.` : `${plural(problems.length, "problem")} found.`);
  if (problems.length === 0) return summary;
  return [`${plural(problems.length, "problem")} found in the Ward Flow data.`, ``, ...problems.map((entry) => `${entry.text}\n`), summary].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Reading the real data. Import where possible; text-parse only what cannot be imported.
// ---------------------------------------------------------------------------------------------

/**
 * The two module-local constants that cannot be imported, read out of the source text.
 *
 * `columnServices` and the morning tour's ids are plain `const`s inside React component files —
 * not exported, and their files cannot be imported outside a React render anyway. So they are read
 * as text, and every parse below returns a PROBLEM rather than an empty result when the shape it
 * expects is not there. A parser that silently finds nothing would turn every check built on it
 * into a check that cannot fail.
 */
export function readTextParsedFacts(readFile) {
  const readingProblems = [];
  const unreadable = (file, what, why) =>
    problem("this-checker-could-not-read-the-file", `${file}`, [
      `check:ward-data could not read ${what} out of this file, so it could NOT check it.`,
      `Reason: ${why}`,
      `This is a problem with the checker, not necessarily with the data — but until it is fixed,`,
      `nothing is checking ${what}, so treat that as unchecked rather than correct.`,
    ]);

  let columnServices = { left: [], right: [] };
  try {
    const source = readFile(FILES.network);
    const block = /const\s+columnServices\b[^=]*=\s*\{([\s\S]*?)\}\s*;/.exec(source);
    if (!block) {
      readingProblems.push(
        unreadable(FILES.network, "the columnServices list", "no `const columnServices = { … };` was found"),
      );
    } else {
      const side = (name) => {
        const found = new RegExp(`${name}\\s*:\\s*\\[([^\\]]*)\\]`).exec(block[1]);
        return found ? [...found[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]) : null;
      };
      const left = side("left");
      const right = side("right");
      if (left === null || right === null) {
        readingProblems.push(
          unreadable(FILES.network, "the columnServices list", "it no longer has both a `left:` and a `right:` array"),
        );
      } else if (left.length === 0 && right.length === 0) {
        readingProblems.push(
          unreadable(FILES.network, "the columnServices list", "both columns parsed as empty, which cannot be right"),
        );
      } else {
        columnServices = { left, right };
      }
    }
  } catch (error) {
    readingProblems.push(unreadable(FILES.network, "the columnServices list", String(error?.message ?? error)));
  }

  const tour = { unitId: null, edId: null };
  try {
    const source = readFile(FILES.tour);
    const unitId = /const\s+TOUR_UNIT_ID\s*=\s*"([^"]+)"/.exec(source);
    const edId = /const\s+TOUR_ED_ID\s*=\s*"([^"]+)"/.exec(source);
    if (!unitId || !edId) {
      readingProblems.push(
        unreadable(
          FILES.tour,
          "the ward and department the morning tour walks through",
          "TOUR_UNIT_ID and TOUR_ED_ID were not both found as plain string constants",
        ),
      );
    } else {
      tour.unitId = unitId[1];
      tour.edId = edId[1];
    }
  } catch (error) {
    readingProblems.push(
      unreadable(FILES.tour, "the ward and department the morning tour walks through", String(error?.message ?? error)),
    );
  }

  return { columnServices, tour, readingProblems };
}

/** Turns the nav rail's hardcoded links into the reference list check 7/8 walk. */
export function navReferences(navItems) {
  const unitReferences = [];
  const edReferences = [];
  for (const item of navItems ?? []) {
    const ward = /\/(?:ward|board)\/([^/?#]+)$/.exec(item.href ?? "");
    if (ward) {
      unitReferences.push({
        unitId: decodeURIComponent(ward[1]),
        where: "Navigation menu",
        detail: item.href,
        label: item.label,
        file: FILES.nav,
      });
      continue;
    }
    const ed = /\/ed\/([^/?#]+)$/.exec(item.href ?? "");
    if (ed) {
      edReferences.push({
        edId: decodeURIComponent(ed[1]),
        where: "Navigation menu",
        detail: item.href,
        label: item.label,
        file: FILES.nav,
      });
    }
  }
  return { unitReferences, edReferences };
}

/** Imports the real modules (needs `tsx`) and text-parses the two that cannot be imported. */
async function loadWardData(root) {
  const load = (relative) => import(pathToFileURL(resolve(root, relative)).href);
  const readFile = (relative) => readFileSync(resolve(root, relative), "utf8");

  const [sites, seed, model, teams, travel, derivations, nav, admissionsModule] = await Promise.all([
    load(FILES.sites),
    load(FILES.seed),
    load(FILES.model),
    load(FILES.teams),
    load(FILES.travel),
    load(FILES.derivations),
    load(FILES.nav),
    load("src/components/ward-management/ward-admissions.ts"),
  ]);

  const { columnServices, tour, readingProblems } = readTextParsedFacts(readFile);
  const { unitReferences, edReferences } = navReferences(nav.WARD_NAV);
  if (tour.unitId) {
    unitReferences.push({
      unitId: tour.unitId,
      where: "Morning bed-state tour",
      detail: "the ward the guided tour walks through (TOUR_UNIT_ID)",
      file: FILES.tour,
    });
  }
  if (tour.edId) {
    edReferences.push({
      edId: tour.edId,
      where: "Morning bed-state tour",
      detail: "the department the guided tour walks through (TOUR_ED_ID)",
      file: FILES.tour,
    });
  }

  return {
    sites: sites.wardSites,
    admissions: seed.wardAdmissions,
    homeRegions: [...model.HOME_REGIONS],
    communityTeams: teams.COMMUNITY_TEAMS,
    travelBands: travel.SYNTHETIC_TRAVEL_BANDS,
    travelBandNames: [...travel.TRAVEL_BANDS],
    serviceOrder: derivations.wardServiceOrder,
    columnServices,
    unitReferences,
    edReferences,
    unitCapacity: derivations.unitCapacity,
    bedIsOccupied: admissionsModule.bedIsOccupied,
    readingProblems,
  };
}

/**
 * Nothing to check is a FAILURE, not a pass.
 *
 * Every check above iterates something. If the import silently produced an empty network or an
 * empty seed — a renamed export, a half-loaded module — every loop would run zero times and the
 * script would print "no problems found", which is exactly the shape of check this repository has
 * shipped before and been bitten by.
 */
function refuseAnEmptyRun(data) {
  const missing = [];
  if (!Array.isArray(data.sites) || data.sites.length === 0) missing.push(`the hospital network (${FILES.sites})`);
  if (!Array.isArray(data.admissions) || data.admissions.length === 0) missing.push(`the people in the beds (${FILES.seed})`);
  if (!Array.isArray(data.homeRegions) || data.homeRegions.length === 0) missing.push(`the list of regions (${FILES.model})`);
  if (!Array.isArray(data.serviceOrder) || data.serviceOrder.length === 0) missing.push(`the health-service order (${FILES.derivations})`);
  if (typeof data.unitCapacity !== "function" || typeof data.bedIsOccupied !== "function") {
    missing.push(`the app's own bed-counting functions`);
  }
  return missing;
}

async function run() {
  let data;
  try {
    data = await loadWardData(ROOT);
  } catch (error) {
    console.error(`check:ward-data — could not read the data files, so NOTHING was checked.`);
    console.error(`This is NOT a clean result. Treat the ward data as unchecked.`);
    console.error(String(error?.message ?? error));
    console.error(`If a file was renamed or moved, update the paths at the top of scripts/check-ward-data.mjs.`);
    process.exit(1);
  }
  const missing = refuseAnEmptyRun(data);
  if (missing.length > 0) {
    console.error(`check:ward-data — could not read the data, so NOTHING was checked.`);
    console.error(`Missing: ${listOut(missing)}.`);
    console.error(`This is a problem with the checker or with how it was run, not a clean result.`);
    process.exit(1);
  }
  const result = checkWardData(data);
  const report = formatReport(result);
  if (result.problems.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

const TSX_FLAG = "WARD_DATA_CHECK_UNDER_TSX";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  if (process.env[TSX_FLAG] === "1") {
    await run();
  } else {
    // The data lives in TypeScript modules, so re-run this same file under `tsx`, which can load
    // them (including the `@/…` import paths). Nothing is written and no network is touched.
    const { resolveTsxCli } = await import("./resolve-tsx-cli.mjs");
    let tsxCli;
    try {
      tsxCli = resolveTsxCli(ROOT);
    } catch (error) {
      console.error(`check:ward-data — could not start, so NOTHING was checked.`);
      console.error(String(error?.message ?? error));
      console.error(`Run "npm ci --include=dev" in this folder first.`);
      process.exit(1);
    }
    const child = spawn(process.execPath, [tsxCli, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      cwd: ROOT,
      env: { ...process.env, [TSX_FLAG]: "1" },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => {
      console.error(`check:ward-data — could not start, so NOTHING was checked.`);
      console.error(String(error?.message ?? error));
      process.exit(1);
    });
    child.once("close", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
  }
}
