// Builds `data/medication-interaction-index.json` from the medication catalogue
// snapshot plus the curated lexicon in `src/lib/medication-interaction-lexicon.ts`.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  INTERACTION_LEXICON,
  LEXICON_SURFACES_BY_LENGTH,
  UNENUMERATED_MECHANISM_TERM_IDS,
  selectCatalogueSlugs,
  type LexiconTerm,
} from "../src/lib/medication-interaction-lexicon";
import type { MedicationRecord } from "../src/lib/medications";

const SNAPSHOT_PATH = "data/medications-snapshot.json";
const OUTPUT_PATH = "data/medication-interaction-index.json";

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
type IndexRow = {
  rowKey: string;
  rowIndex: number;
  severity: string;
  counterparties: string[];
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
  names: Record<string, string>;
  bySlug: Record<string, IndexEntry>;
};

const DOSAGE_FORM_TOKEN =
  /^(ir|sr|xr|mr|cr|odt|lai|im|iv|sl|po|pr|depot|patch|wafer|nasal|mouth|spray|inhaler|topical|cream|gel|drops|syrup|liquid|injection|infusion|oral|buccal|sublingual|transdermal|suppository|tablet|capsule|lozenge|pamoate)$/i;

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
  return tokens.join(" ").replace(/[\s/-]+$/, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(haystack: string, needle: string): boolean {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(needle)}(?![A-Za-z0-9])`, "i");
  return pattern.test(haystack);
}

/**
 * Extract clauses that actually declare counterparties. The first sentence is
 * always considered. Later sentences are considered only when they themselves
 * name a curated interaction term or catalogue drug before explanatory/mitigation
 * prose. This preserves clinically material later clauses (for example
 * methadone's CNS-depressant sentence) without scanning arbitrary advice such as
 * "cover with PPI if combined".
 */
function counterpartySegments(value: string): { severityToken: string | null; segments: string[] } {
  const match = SEVERITY_PATTERN.exec(value);
  const severityToken = match ? match[1].trim() : null;
  const body = (match ? match[2] : value).replace(/\*\*/g, "").trim();
  const sentences = body.split(/(?<=[.;])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  return { severityToken, segments: sentences.length ? sentences : [body] };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sameJson(left: string, right: string): boolean {
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return false;
  }
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const snapshotPath = path.resolve(process.cwd(), SNAPSHOT_PATH);
  const records = JSON.parse(readFileSync(snapshotPath, "utf8")) as MedicationRecord[];

  const termSlugs = new Map<string, string[]>();
  for (const term of INTERACTION_LEXICON) {
    if (term.kind === "catalogue" && term.select) termSlugs.set(term.id, selectCatalogueSlugs(term.select, records));
  }

  const drugSurfaces = records
    .flatMap((record) => {
      // Keep three-character catalogue names/acronyms: `mentions` already
      // enforces alphanumeric boundaries, so dropping them here only creates
      // avoidable false negatives. Two-character route/form tokens remain below
      // the floor to avoid indexing abbreviations such as IR/IM/IV as drugs.
      const parts = record.name.split("/").map((part) => part.trim()).filter((part) => part.length >= 3);
      const surfaces = new Set(parts);
      for (const part of parts) surfaces.add(stripDosageForm(part));
      surfaces.add(stripDosageForm(record.name));
      return Array.from(surfaces)
        .filter((surface) => surface.length >= 3)
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
        const { severityToken, segments } = counterpartySegments(value);
        const severity = severityToken ? (SEVERITY_BY_TOKEN[severityToken] ?? "unknown") : "unknown";
        const counterparties = new Map<string, IndexCounterparty>();
        const termIds = new Set<string>();
        let sawClassifiableTerm = false;

        for (const segment of segments) {
          const segmentTermIds = new Set<string>();
          const segmentCounterparties = new Map<string, IndexCounterparty>();
          const consumed: string[] = [];
          for (const { surface, term } of LEXICON_SURFACES_BY_LENGTH) {
            if (!mentions(segment, surface)) continue;
            if (consumed.some((taken) => taken.includes(surface))) continue;
            consumed.push(surface);
            segmentTermIds.add(term.id);
            addTermTargets(term, segmentCounterparties, record.slug);
          }
          for (const { surface, slug } of drugSurfaces) {
            if (slug === record.slug || !mentions(segment, surface)) continue;
            if (!segmentCounterparties.has(slug)) {
              segmentCounterparties.set(slug, { slug, name: nameBySlug.get(slug) ?? slug, via: surface });
            }
          }

          // Always accept the first sentence. Later sentences qualify only if
          // they contain a recognised interaction term or catalogue counterparty.
          if (segment === segments[0] || segmentTermIds.size > 0 || segmentCounterparties.size > 0) {
            if (segmentTermIds.size > 0 || segmentCounterparties.size > 0) sawClassifiableTerm = true;
            for (const id of segmentTermIds) termIds.add(id);
            for (const [slug, target] of segmentCounterparties) counterparties.set(slug, target);
          }
        }

        const hasUnenumeratedMechanism = Array.from(termIds).some((id) => UNENUMERATED_MECHANISM_TERM_IDS.has(id));
        const resolved = sawClassifiableTerm && !hasUnenumeratedMechanism;
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
    if (rows.length > 0) bySlug[record.slug] = { rows, unresolvedRowCount: rows.filter((row) => !row.resolved).length };
  }

  function addTermTargets(term: LexiconTerm, into: Map<string, IndexCounterparty>, sourceSlug: string): void {
    if (term.kind !== "catalogue") return;
    for (const slug of termSlugs.get(term.id) ?? []) {
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
    names: Object.fromEntries(records.map((record) => [record.slug, record.name] as const).sort(([a], [b]) => a.localeCompare(b))),
    bySlug,
  };

  const serialised = stableJson(index);
  const outputPath = path.resolve(process.cwd(), OUTPUT_PATH);
  if (checkOnly) {
    const current = readFileSync(outputPath, "utf8");
    if (!sameJson(current, serialised)) {
      console.error(`[medication-interactions] ${OUTPUT_PATH} is stale.\nRun \`npm run medications:interactions\` and commit the result.`);
      process.exit(1);
    }
    console.log(`[medication-interactions] ${OUTPUT_PATH} is up to date (${sourceRowCount} rows).`);
    return;
  }

  writeFileSync(outputPath, serialised);
  console.log(`[medication-interactions] wrote ${OUTPUT_PATH}: ${sourceRowCount} rows, ${resolvedRows} resolved, ${unresolvedRows} unresolved, ${index.stats.medicationsWithUnresolvedRows} medications carry an unresolved row.`);
}

main();
