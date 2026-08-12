// Builds `data/medication-interaction-index.json` from the medication catalogue
// snapshot plus the curated lexicon in `src/lib/medication-interaction-lexicon.ts`.
//
// Run with `npm run medications:interactions`. Pass `--check` to verify the
// committed artefact matches what the current snapshot + lexicon produce (used
// by `npm run check:medication-interactions` so the two cannot drift apart).
//
// WHY A BUILD STEP AT ALL
// The catalogue's `Key Interactions` rows are prose. Resolving them at runtime
// would mean shipping the parser and the lexicon to the browser and re-running
// 523 regex passes per render. More importantly it would make the resolution
// invisible: a generated artefact can be diffed, reviewed, and pinned by a test,
// which is what lets a clinician trust the colour on a result row.
//
// WHAT "UNRESOLVED" MEANS AND WHY IT IS EMITTED, NOT SWALLOWED
// A row whose counterparty cannot be resolved to catalogue targets is recorded
// with `resolved: false`. The UI turns any medication carrying such a row grey
// ("N rows need manual review") rather than green. Dropping these rows would
// manufacture a false all-clear, which is the single most dangerous failure
// this feature can have.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  INTERACTION_LEXICON,
  LEXICON_SURFACES_BY_LENGTH,
  selectCatalogueSlugs,
  type LexiconTerm,
} from "../src/lib/medication-interaction-lexicon";
import type { MedicationRecord } from "../src/lib/medications";

const SNAPSHOT_PATH = "data/medications-snapshot.json";
const OUTPUT_PATH = "data/medication-interaction-index.json";

/** Severity tokens seen in the catalogue, normalised to a closed vocabulary. */
const SEVERITY_BY_TOKEN: Record<string, string> = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "moderate",
  CAUTION: "caution",
  LOW: "low",
  NONE: "none",
  SAFE: "safe",
  BENEFICIAL: "beneficial",
};

const SEVERITY_PATTERN = /^\s*([A-Z][A-Z \-/]{2,30}?)\s*[—–-]\s*([\s\S]*)$/;

type IndexCounterparty = { slug: string; name: string; via: string };

/**
 * The emitted row is deliberately lean: no `note`, no counterparty display
 * names. Both are already available to every consumer — the verbatim text lives
 * on the `MedicationRecord` the page has already loaded (addressed by
 * `rowIndex`), and names come from the top-level `names` map. Duplicating them
 * per row took the artefact to 661 KB, which is a bundle regression for a file
 * that ships to the browser.
 */
type IndexRow = {
  rowKey: string;
  rowIndex: number;
  severity: string;
  /** Catalogue slugs this row's counterparty terms resolved to. */
  counterparties: string[];
  /** Lexicon term ids that fired, for auditability. */
  termIds: string[];
  resolved: boolean;
};

type IndexEntry = { rows: IndexRow[]; unresolvedRowCount: number };

type InteractionIndex = {
  version: number;
  generatedFrom: string;
  sourceRowCount: number;
  stats: {
    resolvedRows: number;
    unresolvedRows: number;
    rowsWithCatalogueTarget: number;
    medicationsWithUnresolvedRows: number;
  };
  /** slug → display name, so a counterparty can be named without the snapshot. */
  names: Record<string, string>;
  bySlug: Record<string, IndexEntry>;
};

/** Dosage-form and route qualifiers that appear in catalogue names but not in prose. */
const DOSAGE_FORM_TOKEN =
  /^(ir|sr|xr|mr|cr|odt|lai|im|iv|sl|po|pr|depot|patch|wafer|nasal|mouth|spray|inhaler|topical|cream|gel|drops|syrup|liquid|injection|infusion|oral|buccal|sublingual|transdermal|suppository|tablet|capsule|lozenge|pamoate)$/i;

/**
 * "Tramadol IR" → "Tramadol"; "Oxycodone SR / MR" → "Oxycodone";
 * "Nicotine mouth spray" → "Nicotine". Strips trailing form tokens and the
 * separators between them, iteratively, leaving the drug substance.
 */
function stripDosageForm(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (last === "/" || last === "-" || DOSAGE_FORM_TOKEN.test(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens
    .join(" ")
    .replace(/[\s/-]+$/, "")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word-ish match. Plain `\b` fails on surfaces ending in a non-word
 * character (e.g. "p-gp"), so the boundaries are asserted explicitly against
 * characters that could continue a word.
 */
function mentions(haystack: string, needle: string): boolean {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(needle)}(?![A-Za-z0-9])`, "i");
  return pattern.test(haystack);
}

/**
 * The counterparty segment is the FIRST sentence after the severity token.
 *
 * This is deliberate and load-bearing. Scanning the whole row over-matches:
 * "HIGH — NSAIDs and Aspirin. SSRIs deplete platelet serotonin … Cover with PPI
 * if combined." mentions PPIs only as the mitigation, and a patient on a PPI
 * must not light up as HIGH-interacting. Restricting to the first sentence
 * keeps the counterparty and drops the advice.
 */
function counterpartySegment(value: string): { severityToken: string | null; segment: string } {
  const match = SEVERITY_PATTERN.exec(value);
  const severityToken = match ? match[1].trim() : null;
  const body = (match ? match[2] : value).replace(/\*\*/g, "").trim();
  const [first = ""] = body.split(/(?<=[.;])\s+/);
  return { severityToken, segment: first };
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const snapshotPath = path.resolve(process.cwd(), SNAPSHOT_PATH);
  const records = JSON.parse(readFileSync(snapshotPath, "utf8")) as MedicationRecord[];

  // Pre-resolve every catalogue term once.
  const termSlugs = new Map<string, string[]>();
  for (const term of INTERACTION_LEXICON) {
    if (term.kind === "catalogue" && term.select) {
      termSlugs.set(term.id, selectCatalogueSlugs(term.select, records));
    }
  }

  // Surface forms for individual catalogue drugs, longest-first so
  // "Aripiprazole LAI" wins over "Aripiprazole".
  //
  // Catalogue names carry formulation qualifiers the prose never uses: the
  // catalogue says "Tramadol IR" and "Oxycodone SR / MR" where an interaction
  // row just says "Tramadol" or "Oxycodone". Indexing only the full name silently
  // loses those matches — a false-negative class, i.e. exactly the direction that
  // produces a wrong green. So each name also contributes its base form with the
  // trailing dosage-form tokens stripped.
  const drugSurfaces = records
    .flatMap((record) => {
      const parts = record.name
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part.length >= 4);
      const surfaces = new Set(parts);
      for (const part of parts) surfaces.add(stripDosageForm(part));
      surfaces.add(stripDosageForm(record.name));
      return Array.from(surfaces)
        .filter((surface) => surface.length >= 4)
        .map((surface) => ({ surface, slug: record.slug, name: record.name }));
    })
    .sort((a, b) => b.surface.length - a.surface.length);

  const nameBySlug = new Map(records.map((record) => [record.slug, record.name]));
  const bySlug: Record<string, IndexEntry> = {};
  let sourceRowCount = 0;
  let resolvedRows = 0;
  let unresolvedRows = 0;
  let rowsWithCatalogueTarget = 0;

  for (const record of records) {
    const rows: IndexRow[] = [];

    for (const section of record.sections ?? []) {
      if (section.type !== "inter") continue;

      section.rows?.forEach((row, rowIndex) => {
        sourceRowCount += 1;
        const value = row.val ?? "";
        const { severityToken, segment } = counterpartySegment(value);
        const severity = severityToken ? (SEVERITY_BY_TOKEN[severityToken] ?? "unknown") : "unknown";

        const counterparties = new Map<string, IndexCounterparty>();
        const termIds = new Set<string>();
        let sawClassifiableTerm = false;

        // 1. Lexicon terms, longest surface first.
        const consumed: string[] = [];
        for (const { surface, term } of LEXICON_SURFACES_BY_LENGTH) {
          if (!mentions(segment, surface)) continue;
          // A longer surface already covering this text wins ("thiazide
          // diuretics" must not also register the generic "diuretics").
          if (consumed.some((taken) => taken.includes(surface))) continue;
          consumed.push(surface);
          termIds.add(term.id);
          sawClassifiableTerm = true;
          addTermTargets(term, counterparties, record.slug);
        }

        // 2. Individual catalogue drugs named outright.
        for (const { surface, slug } of drugSurfaces) {
          if (slug === record.slug) continue; // never self-interact
          if (!mentions(segment, surface)) continue;
          sawClassifiableTerm = true;
          if (!counterparties.has(slug)) {
            counterparties.set(slug, { slug, name: nameBySlug.get(slug) ?? slug, via: surface });
          }
        }

        // A row is resolved when we could classify what it refers to — either
        // catalogue targets, or a known external/non-drug entity. A bare
        // mechanism class ("CYP3A4 inhibitors") with no named example is NOT
        // resolved: it could include catalogue drugs we have not enumerated.
        const onlyMechanism =
          termIds.size > 0 &&
          counterparties.size === 0 &&
          Array.from(termIds).every((id) => termKind(id) === "mechanism");
        const resolved = sawClassifiableTerm && !onlyMechanism;

        if (resolved) resolvedRows += 1;
        else unresolvedRows += 1;
        if (counterparties.size > 0) rowsWithCatalogueTarget += 1;

        rows.push({
          rowKey: row.key,
          rowIndex,
          severity,
          counterparties: Array.from(counterparties.keys()).sort(),
          termIds: Array.from(termIds).sort(),
          resolved,
        });
      });
    }

    if (rows.length > 0) {
      bySlug[record.slug] = { rows, unresolvedRowCount: rows.filter((row) => !row.resolved).length };
    }
  }

  function termKind(id: string): string {
    return INTERACTION_LEXICON.find((term) => term.id === id)?.kind ?? "mechanism";
  }

  function addTermTargets(term: LexiconTerm, into: Map<string, IndexCounterparty>, sourceSlug: string): void {
    if (term.kind !== "catalogue") return;
    for (const slug of termSlugs.get(term.id) ?? []) {
      // A drug is never its own counterparty. Ibuprofen's own row says "NSAIDs",
      // and the class resolves to every NSAID including ibuprofen — which would
      // make the drug flag itself the moment the patient is taking it.
      if (slug === sourceSlug || into.has(slug)) continue;
      into.set(slug, { slug, name: nameBySlug.get(slug) ?? slug, via: term.id });
    }
  }

  const index: InteractionIndex = {
    version: 1,
    generatedFrom: SNAPSHOT_PATH,
    sourceRowCount,
    stats: {
      resolvedRows,
      unresolvedRows,
      rowsWithCatalogueTarget,
      medicationsWithUnresolvedRows: Object.values(bySlug).filter((entry) => entry.unresolvedRowCount > 0).length,
    },
    names: Object.fromEntries(
      records.map((record) => [record.slug, record.name] as const).sort(([a], [b]) => a.localeCompare(b)),
    ),
    bySlug,
  };

  const serialised = `${JSON.stringify(index, null, 2)}\n`;
  const outputPath = path.resolve(process.cwd(), OUTPUT_PATH);

  if (checkOnly) {
    const current = readFileSync(outputPath, "utf8");
    if (current !== serialised) {
      console.error(
        `[medication-interactions] ${OUTPUT_PATH} is stale.\n` +
          "Run `npm run medications:interactions` and commit the result.",
      );
      process.exit(1);
    }
    console.log(`[medication-interactions] ${OUTPUT_PATH} is up to date (${sourceRowCount} rows).`);
    return;
  }

  writeFileSync(outputPath, serialised);
  console.log(
    `[medication-interactions] wrote ${OUTPUT_PATH}: ${sourceRowCount} rows, ` +
      `${resolvedRows} resolved, ${unresolvedRows} unresolved, ` +
      `${index.stats.medicationsWithUnresolvedRows} medications carry an unresolved row.`,
  );
}

main();
