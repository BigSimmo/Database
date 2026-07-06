import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeAccessibleTable } from "../src/lib/accessible-table-normalization";
import { formatAnswerForClipboard, formatWardNote } from "../src/lib/ward-output";
import type { RagAnswer } from "../src/lib/types";

// Properties for clinical table normalization and its export paths.
//
// The 2026-07-01 audit's H4/M8/M16 cluster was about copied ward-note tables
// silently diverging from the on-screen table: dropped low-confidence caveats,
// duplicated header rows, and ragged rows shifting values under the wrong
// column. These properties pin the invariants over generated tables:
//   1. normalization always yields a rectangular grid,
//   2. no numeric value is invented or lost by normalization,
//   3. rows are only ever dropped/merged with the lowConfidence flag raised
//      (for clinical tables), and
//   4. the lowConfidence caveat survives BOTH clipboard export paths.

const LOW_CONFIDENCE_CAVEAT = "verify values against the source document";

const namedHeaders = ["ANC level", "Action", "Dose", "Frequency", "Parameter", "Escalation"] as const;
const cellPool = [
  "Below 1.5",
  "1.5-2.0",
  "Above 2.0",
  "12.5 mg daily",
  "withhold dose",
  "increase monitoring",
  "contact prescriber",
  "review weekly",
  "continue treatment",
  "",
] as const;
const nonEmptyCellPool = cellPool.filter(Boolean);

const cell = fc.constantFrom(...cellPool);
const nonEmptyCell = fc.constantFrom(...nonEmptyCellPool);

function distinctHeaders(count: number) {
  return fc.shuffledSubarray([...namedHeaders], { minLength: count, maxLength: count }).map((headers) => [...headers]);
}

// Ragged rows: cell counts deliberately range past the header width (M16).
function rowsFor(columnCount: number) {
  return fc.array(
    fc
      .tuple(nonEmptyCell, fc.array(cell, { minLength: 0, maxLength: columnCount }))
      .map(([first, rest]) => [first, ...rest]),
    { minLength: 2, maxLength: 6 },
  );
}

const cleanTable = fc
  .integer({ min: 2, max: 4 })
  .chain((columnCount) => fc.tuple(distinctHeaders(columnCount), rowsFor(columnCount)));

// A clinical table with a generic column interleaved between named ones — the
// ambiguity that must force the conservative raw-grid fallback + caveat.
const ambiguousClinicalTable = fc
  .tuple(distinctHeaders(2), rowsFor(3))
  .map(([headers, rows]) => ({ columns: ["ANC level", "", headers[1]], rows }));

function numericTokens(cells: string[]) {
  return new Set(cells.join(" ").match(/\d+(?:\.\d+)?/g) ?? []);
}

function tableCells(table: { header: string[]; body: string[][] }) {
  return [...table.header, ...table.body.flat()];
}

function answerWithTable(rows: string[][], columns: string[]): RagAnswer {
  // Mirrors the H4 regression fixture in ward-output.test.ts: a grounded
  // answer whose visual evidence carries threshold rows, so the table is
  // promoted into the thresholds section of both export formats.
  return {
    answer: "Withhold clozapine if ANC is below the required threshold and urgently review.",
    grounded: true,
    confidence: "medium",
    citations: [
      {
        chunk_id: "chunk-1",
        document_id: "doc-1",
        title: "Clozapine source",
        file_name: "clozapine.pdf",
        page_number: 2,
        chunk_index: 0,
      },
    ],
    sources: [],
    answerSections: [
      {
        heading: "Threshold",
        body: "Withhold clozapine if ANC is below the required threshold and urgently review.",
        citation_chunk_ids: ["chunk-1"],
      },
    ],
    visualEvidence: [
      {
        id: "image-1",
        image_id: "image-1",
        signed_url_endpoint: "/api/images/image-1/signed-url",
        caption: "FBC/ANC monitoring thresholds",
        document_id: "doc-1",
        title: "Clozapine source",
        file_name: "clozapine.pdf",
        page_number: 2,
        source_chunk_id: "chunk-1",
        chunk_index: 0,
        viewer_href: "/documents/doc-1?page=2&chunk=chunk-1",
        tableLabel: "Table 1",
        tableTitle: "FBC/ANC thresholds",
        tableRows: rows,
        tableColumns: columns,
      },
    ],
  };
}

describe("property: accessible table normalization", () => {
  it("always yields a rectangular grid with no invented or lost numeric values", () => {
    fc.assert(
      fc.property(cleanTable, ([columns, rows]) => {
        const normalized = normalizeAccessibleTable(rows, columns, { conservativeClinical: true });
        if (!normalized) return;

        for (const row of normalized.body) {
          expect(row).toHaveLength(normalized.header.length);
        }

        const inputTokens = numericTokens([...columns, ...rows.flat()]);
        const outputTokens = numericTokens(tableCells(normalized));
        for (const token of outputTokens) {
          expect(inputTokens).toContain(token);
        }
        for (const token of inputTokens) {
          expect(outputTokens).toContain(token);
        }
      }),
    );
  });

  it("preserves the row count exactly when every row anchors on a non-empty first cell", () => {
    fc.assert(
      fc.property(cleanTable, ([columns, rows]) => {
        const normalized = normalizeAccessibleTable(rows, columns, { conservativeClinical: true });
        const expectedRows = rows.filter((row) => row.some((value) => value.trim() && !/^[-–—]+$/.test(value.trim())));
        expect(normalized?.body ?? []).toHaveLength(expectedRows.length);
      }),
    );
  });

  it("flags ambiguous clinical tables low-confidence and preserves their raw row/column counts", () => {
    fc.assert(
      fc.property(ambiguousClinicalTable, ({ columns, rows }) => {
        const normalized = normalizeAccessibleTable(rows, columns, { conservativeClinical: true });
        expect(normalized).not.toBeNull();
        expect(normalized?.lowConfidence).toBe(true);

        // Conservative fallback: raw grid preserved 1:1 — no merges, no drops.
        const sourceColumnCount = Math.max(columns.length, ...rows.map((row) => row.length));
        expect(normalized?.header).toHaveLength(sourceColumnCount);
        const nonEmptyRows = rows.filter((row) => row.some((value) => value.trim() && !/^[-–—]+$/.test(value.trim())));
        expect(normalized?.body).toHaveLength(nonEmptyRows.length);
      }),
    );
  });
});

describe("property: low-confidence caveat survives every export path (H4)", () => {
  it("ward note and clipboard always carry the caveat when normalization is low-confidence", () => {
    fc.assert(
      fc.property(ambiguousClinicalTable, ({ columns, rows }) => {
        const answer = answerWithTable(rows, columns);
        for (const exported of [formatAnswerForClipboard(answer), formatWardNote(answer, false)]) {
          expect(exported).toContain(LOW_CONFIDENCE_CAVEAT);
        }
      }),
    );
  });

  it("clean tables do not gain a spurious caveat, and low-confidence ones render their rows (canary)", () => {
    fc.assert(
      fc.property(cleanTable, ([columns, rows]) => {
        const normalized = normalizeAccessibleTable(rows, columns, { conservativeClinical: true });
        fc.pre(Boolean(normalized) && !normalized?.lowConfidence);
        const exported = formatAnswerForClipboard(answerWithTable(rows, columns));
        expect(exported).not.toContain(LOW_CONFIDENCE_CAVEAT);
      }),
    );

    // Non-vacuity canary: the ambiguous fixture really is promoted into the
    // exported note — the caveat property above cannot pass on an empty
    // output. Uses the known-ambiguous shape from the H4 regression test.
    const exported = formatAnswerForClipboard(
      answerWithTable(
        [
          ["Below 1.5", "withhold dose", "contact prescriber"],
          ["1.5-2.0", "increase monitoring", "review threshold"],
        ],
        ["ANC level", "", "Action"],
      ),
    );
    expect(exported).toContain("| Below 1.5 |");
    expect(exported).toContain(LOW_CONFIDENCE_CAVEAT);
  });
});
