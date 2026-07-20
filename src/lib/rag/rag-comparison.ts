import { citationFromResult } from "@/lib/citations";
import { sourceTextForVerbatimQuote } from "@/lib/source-text-sanitizer";
import type {
  ComparisonEvaluationState,
  ComparisonMatrix,
  ComparisonMatrixEntry,
  ComparisonMatrixRow,
  DocumentTableFact,
  RagAnswer,
  SearchResult,
} from "@/lib/types";

type ComparisonFact = {
  parameter: string;
  documentId: string;
  chunkId: string;
  value: string;
  qualifiers: string[];
  structured: boolean;
};

export type ComparisonMatrixResult = {
  matrix: ComparisonMatrix;
  evaluationState: ComparisonEvaluationState;
  hasStructuredEvidence: boolean;
};

export type SelectedComparisonDocument =
  | string
  | {
      documentId: string;
      title?: string;
      fileName?: string;
    };

type ComparisonMatrixArgs = {
  query: string;
  results: SearchResult[];
  selectedDocuments?: SelectedComparisonDocument[];
};

function safeDisplay(value: unknown) {
  return typeof value === "string" ? sourceTextForVerbatimQuote(value).trim() : "";
}

function normalizedKey(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function factFromTable(result: SearchResult, fact: DocumentTableFact): ComparisonFact | null {
  const parameter = safeDisplay(fact.clinical_parameter || fact.row_label || fact.table_title);
  const value = safeDisplay(fact.threshold_value || fact.action);
  if (!parameter || !value) return null;
  return {
    parameter,
    documentId: result.document_id,
    chunkId: fact.source_chunk_id || result.id,
    value,
    qualifiers: unique(
      [fact.action, fact.row_label, fact.table_title]
        .map(safeDisplay)
        .filter((item) => item && normalizedKey(item) !== normalizedKey(value)),
    ),
    structured: true,
  };
}

function objectString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = safeDisplay(record[key]);
    if (value) return value;
  }
  return "";
}

function factFromIndexUnit(result: SearchResult): ComparisonFact | null {
  const unit = result.index_unit;
  if (!unit) return null;
  const metadata = unit.metadata ?? {};
  const sourceSpan = unit.source_span ?? {};
  const parameter =
    objectString(metadata, ["clinical_parameter", "parameter", "row_label"]) ||
    objectString(sourceSpan, ["clinical_parameter", "parameter", "row_label"]);
  const value =
    objectString(metadata, ["threshold_value", "value", "fact_value"]) ||
    objectString(sourceSpan, ["threshold_value", "value", "fact_value"]);
  if (!parameter || !value) return null;
  const qualifier =
    objectString(metadata, ["action", "qualifier"]) || objectString(sourceSpan, ["action", "qualifier"]);
  return {
    parameter,
    documentId: result.document_id,
    chunkId: unit.source_chunk_id || result.id,
    value,
    qualifiers: unique([qualifier, safeDisplay(unit.title)]),
    structured: true,
  };
}

const comparisonQueryStopWords = new Set([
  "compare",
  "compared",
  "comparison",
  "between",
  "versus",
  "difference",
  "differences",
  "documents",
  "document",
  "sources",
  "source",
  "guidance",
  "protocol",
  "protocols",
  "the",
  "and",
  "for",
  "from",
  "with",
]);

function requestedParameter(query: string) {
  const words = safeDisplay(query)
    .replace(/[?!.]+$/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !comparisonQueryStopWords.has(word.toLocaleLowerCase()));
  return words.join(" ") || "Source guidance";
}

function boundedSourceSentence(result: SearchResult, query: string): ComparisonFact | null {
  const queryTokens = requestedParameter(query)
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const sentences = safeDisplay(result.content)
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const sentence = sentences.find((candidate) => {
    const normalized = candidate.toLocaleLowerCase();
    return queryTokens.length === 0 || queryTokens.some((token) => normalized.includes(token));
  });
  if (!sentence) return null;
  return {
    parameter: requestedParameter(query),
    documentId: result.document_id,
    chunkId: result.id,
    value: sentence.slice(0, 360).trim(),
    qualifiers: [],
    structured: false,
  };
}

function selectedDocuments(
  results: SearchResult[],
  explicitDocuments: SelectedComparisonDocument[] = [],
): ComparisonMatrix["documents"] {
  const documents = new Map<string, ComparisonMatrix["documents"][number]>();
  for (const selected of explicitDocuments) {
    const documentId = safeDisplay(typeof selected === "string" ? selected : selected.documentId);
    if (!documentId || documents.has(documentId)) continue;
    const title = safeDisplay(typeof selected === "string" ? "" : selected.title);
    const fileName = safeDisplay(typeof selected === "string" ? "" : selected.fileName);
    documents.set(documentId, { documentId, title: title || documentId, fileName });
  }
  for (const result of results) {
    const existing = documents.get(result.document_id);
    if (existing) {
      if (existing.title === existing.documentId) existing.title = result.title;
      if (!existing.fileName) existing.fileName = result.file_name;
      continue;
    }
    documents.set(result.document_id, {
      documentId: result.document_id,
      title: result.title,
      fileName: result.file_name,
    });
  }
  return Array.from(documents.values());
}

function entryForDocument(parameter: string, documentId: string, facts: ComparisonFact[]): ComparisonMatrixEntry {
  const matching = facts.filter(
    (fact) => fact.documentId === documentId && normalizedKey(fact.parameter) === normalizedKey(parameter),
  );
  if (matching.length === 0) {
    return {
      documentId,
      chunkIds: [],
      value: null,
      qualifiers: [`No evidence found for ${parameter}`],
    };
  }
  const values = unique(matching.map((fact) => fact.value));
  return {
    documentId,
    chunkIds: unique(matching.map((fact) => fact.chunkId)),
    value: values.join("; "),
    qualifiers: unique(matching.flatMap((fact) => fact.qualifiers)),
  };
}

function rowStatus(entries: ComparisonMatrixEntry[]): ComparisonMatrixRow["status"] {
  if (entries.some((entry) => entry.value === null)) return "missing";
  const values = new Set(entries.map((entry) => normalizedKey(entry.value ?? "")));
  return values.size > 1 ? "conflict" : "agreement";
}

function parameterMatchesRequest(parameter: string, requested: string) {
  const parameterTokens = new Set(
    normalizedKey(parameter)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  return normalizedKey(requested)
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .some((token) => parameterTokens.has(token) || parameterTokens.has(token.replace(/s$/, "")));
}

export function buildComparisonMatrix(args: ComparisonMatrixArgs): ComparisonMatrixResult {
  const documents = selectedDocuments(args.results, args.selectedDocuments);
  const structuredFacts = args.results.flatMap((result) => [
    ...(result.table_facts ?? [])
      .map((fact) => factFromTable(result, fact))
      .filter((fact): fact is ComparisonFact => !!fact),
    ...(result.table_facts?.length ? [] : [factFromIndexUnit(result)].filter((fact): fact is ComparisonFact => !!fact)),
  ]);
  const facts = structuredFacts.length
    ? structuredFacts
    : args.results
        .map((result) => boundedSourceSentence(result, args.query))
        .filter((fact): fact is ComparisonFact => !!fact);
  const requested = requestedParameter(args.query);
  const parameters = unique(facts.map((fact) => fact.parameter));
  const explicitlyScoped = Boolean(args.selectedDocuments?.length);
  if (explicitlyScoped && !parameters.some((parameter) => parameterMatchesRequest(parameter, requested))) {
    parameters.push(requested);
  }
  const rows = parameters.map((parameter) => {
    const entries = documents.map((document) => entryForDocument(parameter, document.documentId, facts));
    return { parameter, entries, status: rowStatus(entries) } satisfies ComparisonMatrixRow;
  });
  const requestedRows = rows.filter((row) => parameterMatchesRequest(row.parameter, requested));
  const evaluationRows = requestedRows.length > 0 ? requestedRows : explicitlyScoped ? [] : rows;
  return {
    matrix: { documents, rows },
    evaluationState: evaluationRows.some((row) => row.entries.filter((entry) => entry.value !== null).length >= 2)
      ? "evaluated"
      : "not_evaluated",
    hasStructuredEvidence: facts.some((fact) => fact.structured),
  };
}

export function canBuildDeterministicComparison(args: ComparisonMatrixArgs) {
  const comparison = buildComparisonMatrix(args);
  return (
    comparison.evaluationState === "evaluated" &&
    comparison.hasStructuredEvidence &&
    comparison.matrix.rows.some((row) => row.entries.filter((entry) => entry.value !== null).length >= 2)
  );
}

function documentLabel(matrix: ComparisonMatrix, documentId: string) {
  return matrix.documents.find((document) => document.documentId === documentId)?.title ?? documentId;
}

export function buildComparisonAnswer(args: {
  query: string;
  results: SearchResult[];
  selectedDocuments?: SelectedComparisonDocument[];
  routeReason: string;
  timings?: RagAnswer["latencyTimings"];
}): RagAnswer | null {
  const comparison = buildComparisonMatrix(args);
  const comparableRows = comparison.matrix.rows.filter(
    (row) => row.entries.filter((entry) => entry.value !== null).length >= 2,
  );
  if (comparison.evaluationState !== "evaluated" || !comparison.hasStructuredEvidence || comparableRows.length === 0)
    return null;

  const lines = comparison.matrix.rows.map((row) => {
    const presentValues = new Set(
      row.entries.filter((entry) => entry.value !== null).map((entry) => normalizedKey(entry.value ?? "")),
    );
    const status =
      row.status === "agreement"
        ? "Agreement"
        : row.status === "conflict"
          ? "Conflict"
          : presentValues.size > 1
            ? "Conflict with evidence gap"
            : "Evidence gap";
    const values = row.entries
      .map((entry) => {
        const label = documentLabel(comparison.matrix, entry.documentId);
        return `${label}: ${entry.value ?? "no evidence found"}`;
      })
      .join("; ");
    return `${status} — ${row.parameter}: ${values}.`;
  });
  const citationIds = unique(comparison.matrix.rows.flatMap((row) => row.entries.flatMap((entry) => entry.chunkIds)));
  const resultById = new Map(args.results.map((result) => [result.id, result]));
  const citations = citationIds.flatMap((chunkId) => {
    const result = resultById.get(chunkId);
    return result ? [citationFromResult(result, "deterministic_support")] : [];
  });

  return {
    answer: lines.join(" "),
    grounded: citations.length > 0,
    confidence: citations.length > 1 ? "high" : "medium",
    citations,
    sources: args.results,
    modelUsed: null,
    routingMode: "extractive",
    routingReason: args.routeReason,
    queryClass: "comparison",
    responseMode: "comparison_matrix",
    preformatted: true,
    latencyTimings: args.timings,
    comparisonMatrix: comparison.matrix,
    comparisonEvaluationState: comparison.evaluationState,
    answerSections: [
      {
        heading: "Source comparison",
        kind: "comparison",
        supportLevel: "direct",
        body: lines.join("\n"),
        citation_chunk_ids: citationIds,
      },
    ],
  } satisfies RagAnswer;
}

export function buildComparisonEvidenceGapAnswer(args: {
  query: string;
  results: SearchResult[];
  selectedDocuments?: SelectedComparisonDocument[];
  routeReason: string;
  timings?: RagAnswer["latencyTimings"];
}): RagAnswer {
  const comparison = buildComparisonMatrix(args);
  return {
    answer:
      "The selected sources do not contain enough source-attributed evidence to evaluate this comparison. Review the linked source passages or broaden the document scope.",
    grounded: false,
    confidence: "unsupported",
    citations: [],
    sources: args.results,
    modelUsed: null,
    routingMode: "unsupported",
    routingReason: args.routeReason,
    queryClass: "comparison",
    responseMode: "evidence_gap",
    preformatted: true,
    latencyTimings: args.timings,
    comparisonMatrix: comparison.matrix,
    comparisonEvaluationState: comparison.evaluationState,
    answerSections: [],
  } satisfies RagAnswer;
}

export function comparisonEvidenceGuide(args: ComparisonMatrixArgs) {
  const comparison = buildComparisonMatrix(args);
  if (comparison.evaluationState !== "evaluated") return "Comparison not evaluated: insufficient attributed evidence.";
  return comparison.matrix.rows
    .flatMap((row) =>
      row.entries.map(
        (entry) =>
          `${row.parameter} | ${documentLabel(comparison.matrix, entry.documentId)} | ${entry.value ?? "MISSING"} | chunks: ${entry.chunkIds.join(", ") || "none"}`,
      ),
    )
    .join("\n");
}
