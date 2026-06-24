import { clinicalVocabularyTerms } from "@/lib/clinical-vocabulary";
import type { ImageEvidenceCategory } from "@/lib/types";

export const visualIntelligenceVersion = "visual-intelligence-v1" as const;

export type VisualTextItem = {
  label: string;
  value?: string | null;
  action?: string | null;
  confidence: number;
  source_text?: string | null;
};

export type VisualFlowchartNode = {
  id: string;
  label: string;
  type?: string | null;
};

export type VisualFlowchartEdge = {
  from: string;
  to: string;
  label?: string | null;
};

export type VisualRiskMatrixCell = {
  row: string;
  column: string;
  risk: string;
  action?: string | null;
  confidence: number;
};

export type VisualChartFinding = {
  label: string;
  value?: string | null;
  interpretation?: string | null;
  confidence: number;
};

export type StructuredVisualProfile = {
  clinical_purpose: string | null;
  key_terms: string[];
  medications: string[];
  thresholds: VisualTextItem[];
  actions: string[];
  monitoring_items: string[];
  flowchart_nodes: VisualFlowchartNode[];
  flowchart_edges: VisualFlowchartEdge[];
  risk_matrix_axes: string[];
  risk_matrix_cells: VisualRiskMatrixCell[];
  chart_axes: string[];
  chart_findings: VisualChartFinding[];
  table_column_roles: Record<string, string>;
  source_regions: Array<Record<string, unknown>>;
  confidence: number;
};

export type VisualCandidateInput = {
  id?: string | null;
  originalIndex?: number;
  pageNumber: number | null;
  width?: number | null;
  height?: number | null;
  bbox?: unknown;
  sourceKind?: string | null;
  imageType?: ImageEvidenceCategory | string | null;
  imageHash?: string | null;
  perceptualHash?: string | null;
  metadata?: Record<string, unknown> | null;
  nearbyText?: string | null;
};

export type RankedVisualCandidate = VisualCandidateInput & {
  originalIndex: number;
  candidatePriorityScore: number;
  imageQualityScore: number;
  cropCompleteness: number;
  ocrTextDensity: number;
  captionBudgetClass:
    | "clinical_table"
    | "flowchart"
    | "risk_matrix"
    | "medication_chart"
    | "form_checklist"
    | "graph"
    | "clinical_region"
    | "admin_reference"
    | "low_signal";
  reasons: string[];
  duplicateGroup: string | null;
};

const clinicalSignalPattern =
  /\b(?:dose|mg|mcg|mmol|anc|fbc|wbc|monitor|threshold|withhold|cease|stop|urgent|review|risk|escalat|flowchart|algorithm|action|route|im\b|po\b|medication|clozapine|lithium|observations?|checklist)\b/i;
const adminSignalPattern =
  /\b(?:authori[sz]ed|approval|version|effective date|review date|amendment|document owner|references?|bibliography|legislation|associated documents?)\b/i;
const supportedColumnRoles = new Set([
  "parameter",
  "threshold",
  "action",
  "dose",
  "route",
  "frequency",
  "monitoring",
  "risk",
  "medication",
  "score",
  "state",
  "notes",
]);

function compact(value: unknown, limit = 360) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit - 3).trim()}...`;
}

function clamp01(value: unknown, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function compactStringArray(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of value) {
    const text = compact(entry, 120);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    values.push(text);
    if (values.length >= limit) break;
  }
  return values;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeTextItem(value: unknown): VisualTextItem | null {
  const row = safeRecord(value);
  const label = compact(row.label ?? row.name ?? row.parameter ?? row.title, 140);
  const valueText = compact(row.value ?? row.threshold ?? row.dose ?? row.range, 160);
  const action = compact(row.action ?? row.response ?? row.management, 220);
  if (!label && !valueText && !action) return null;
  return {
    label: label || valueText || action,
    value: valueText || null,
    action: action || null,
    confidence: clamp01(row.confidence, 0.65),
    source_text: compact(row.source_text ?? row.text, 260) || null,
  };
}

function normalizeNode(value: unknown): VisualFlowchartNode | null {
  const row = safeRecord(value);
  const label = compact(row.label ?? row.text ?? row.title, 180);
  if (!label) return null;
  return {
    id: compact(row.id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), 80),
    label,
    type: compact(row.type, 80) || null,
  };
}

function normalizeEdge(value: unknown): VisualFlowchartEdge | null {
  const row = safeRecord(value);
  const from = compact(row.from ?? row.source, 80);
  const to = compact(row.to ?? row.target, 80);
  if (!from || !to || from === to) return null;
  return {
    from,
    to,
    label: compact(row.label ?? row.condition, 140) || null,
  };
}

function normalizeRiskCell(value: unknown): VisualRiskMatrixCell | null {
  const row = safeRecord(value);
  const risk = compact(row.risk ?? row.level ?? row.value, 120);
  const matrixRow = compact(row.row ?? row.likelihood ?? row.y, 120);
  const column = compact(row.column ?? row.consequence ?? row.x, 120);
  if (!risk || (!matrixRow && !column)) return null;
  return {
    row: matrixRow || "unspecified row",
    column: column || "unspecified column",
    risk,
    action: compact(row.action ?? row.response, 220) || null,
    confidence: clamp01(row.confidence, 0.65),
  };
}

function normalizeChartFinding(value: unknown): VisualChartFinding | null {
  const row = safeRecord(value);
  const label = compact(row.label ?? row.finding ?? row.series, 160);
  const interpretation = compact(row.interpretation ?? row.meaning, 240);
  const valueText = compact(row.value ?? row.measure, 120);
  if (!label && !interpretation) return null;
  return {
    label: label || interpretation,
    value: valueText || null,
    interpretation: interpretation || null,
    confidence: clamp01(row.confidence, 0.65),
  };
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string, limit = 20) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyFor(value).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeStructuredVisualProfile(
  value: unknown,
  options: { fallbackText?: string | null; fallbackConfidence?: number } = {},
): StructuredVisualProfile {
  const raw = safeRecord(value);
  const fallbackText = compact(options.fallbackText, 700);
  const derivedTerms = clinicalVocabularyTerms(fallbackText, 10);
  const columnRolesRaw = safeRecord(raw.table_column_roles);
  const table_column_roles = Object.fromEntries(
    Object.entries(columnRolesRaw)
      .map(([column, role]) => [compact(column, 80), compact(role, 80).toLowerCase()])
      .filter(([column, role]) => column && supportedColumnRoles.has(role)),
  );
  const thresholds = uniqueBy(
    (Array.isArray(raw.thresholds) ? raw.thresholds : []).map(normalizeTextItem).filter(Boolean) as VisualTextItem[],
    (item) => `${item.label}:${item.value ?? ""}:${item.action ?? ""}`,
    24,
  );

  return {
    clinical_purpose: compact(raw.clinical_purpose ?? raw.purpose ?? fallbackText, 280) || null,
    key_terms: uniqueBy([...compactStringArray(raw.key_terms), ...derivedTerms], (term) => term, 16),
    medications: compactStringArray(raw.medications, 16),
    thresholds,
    actions: compactStringArray(raw.actions, 24),
    monitoring_items: compactStringArray(raw.monitoring_items, 20),
    flowchart_nodes: uniqueBy(
      (Array.isArray(raw.flowchart_nodes) ? raw.flowchart_nodes : []).map(normalizeNode).filter(Boolean) as VisualFlowchartNode[],
      (node) => node.id || node.label,
      30,
    ),
    flowchart_edges: uniqueBy(
      (Array.isArray(raw.flowchart_edges) ? raw.flowchart_edges : []).map(normalizeEdge).filter(Boolean) as VisualFlowchartEdge[],
      (edge) => `${edge.from}:${edge.to}:${edge.label ?? ""}`,
      40,
    ),
    risk_matrix_axes: compactStringArray(raw.risk_matrix_axes, 6),
    risk_matrix_cells: uniqueBy(
      (Array.isArray(raw.risk_matrix_cells) ? raw.risk_matrix_cells : []).map(normalizeRiskCell).filter(Boolean) as VisualRiskMatrixCell[],
      (cell) => `${cell.row}:${cell.column}:${cell.risk}:${cell.action ?? ""}`,
      24,
    ),
    chart_axes: compactStringArray(raw.chart_axes, 6),
    chart_findings: uniqueBy(
      (Array.isArray(raw.chart_findings) ? raw.chart_findings : []).map(normalizeChartFinding).filter(Boolean) as VisualChartFinding[],
      (finding) => `${finding.label}:${finding.value ?? ""}:${finding.interpretation ?? ""}`,
      18,
    ),
    table_column_roles,
    source_regions: Array.isArray(raw.source_regions) ? raw.source_regions.map(safeRecord).slice(0, 12) : [],
    confidence: clamp01(raw.confidence ?? raw.structured_extraction_confidence, options.fallbackConfidence ?? 0.55),
  };
}

export function deterministicStructuredVisualProfile(args: {
  imageType?: string | null;
  caption?: string | null;
  tableTitle?: string | null;
  tableLabel?: string | null;
  tableTextSnippet?: string | null;
  tableRows?: string[][] | null;
  tableColumns?: string[] | null;
  metadata?: Record<string, unknown> | null;
}) {
  const text = compact(
    [args.tableTitle, args.tableLabel, args.caption, args.tableTextSnippet, args.tableRows?.flat().join(" ")]
      .filter(Boolean)
      .join(" | "),
    1600,
  );
  const tableColumnRoles: Record<string, string> = {};
  for (const column of args.tableColumns ?? []) {
    const normalized = column.toLowerCase();
    if (/medication|drug/.test(normalized)) tableColumnRoles[column] = "medication";
    else if (/dose|mg|mcg|route/.test(normalized)) tableColumnRoles[column] = /route/.test(normalized) ? "route" : "dose";
    else if (/frequency|schedule/.test(normalized)) tableColumnRoles[column] = "frequency";
    else if (/threshold|range|value|level|count/.test(normalized)) tableColumnRoles[column] = "threshold";
    else if (/action|management|response|intervention|required/.test(normalized)) tableColumnRoles[column] = "action";
    else if (/monitor|test|fbc|anc/.test(normalized)) tableColumnRoles[column] = "monitoring";
    else if (/risk|score|severity/.test(normalized)) tableColumnRoles[column] = "risk";
    else if (/parameter|criterion|state|item/.test(normalized)) tableColumnRoles[column] = "parameter";
  }
  const thresholds: VisualTextItem[] = [];
  for (const row of args.tableRows?.slice(0, 20) ?? []) {
    const rowText = compact(row.join(" | "), 500);
    if (!/(?:\d|threshold|mg|mcg|mmol|anc|fbc|wbc|score|withhold|cease|stop|red|amber|green)/i.test(rowText)) continue;
    thresholds.push({
      label: compact(row[0], 120) || args.tableTitle || "Table threshold",
      value: row.find((cell) => /(?:\d|mg|mcg|mmol|anc|fbc|wbc|score|red|amber|green)/i.test(cell)) ?? null,
      action: row.find((cell) => /(?:withhold|cease|stop|monitor|repeat|review|escalat|continue)/i.test(cell)) ?? null,
      confidence: 0.72,
      source_text: rowText,
    });
  }
  return normalizeStructuredVisualProfile(
    {
      clinical_purpose: compact([args.tableTitle, args.tableLabel, args.caption].filter(Boolean).join(" | "), 280),
      key_terms: clinicalVocabularyTerms(text, 12),
      medications: clinicalVocabularyTerms(text, 24).filter((term) =>
        /clozapine|lithium|olanzapine|lorazepam|haloperidol|diazepam|antipsychotic/i.test(term),
      ),
      thresholds,
      actions: text.match(/\b(?:withhold|cease|stop|repeat|monitor|review|escalate|continue)[^.|\n]{0,120}/gi) ?? [],
      monitoring_items: text.match(/\b(?:FBC|ANC|WBC|level|observations?|monitoring|blood test)[^.|\n]{0,80}/gi) ?? [],
      table_column_roles: tableColumnRoles,
      confidence: thresholds.length || Object.keys(tableColumnRoles).length ? 0.72 : 0.52,
    },
    { fallbackText: text, fallbackConfidence: 0.55 },
  );
}

function textDensity(metadata: Record<string, unknown>, width?: number | null, height?: number | null) {
  const tableText = compact(metadata.table_text ?? metadata.accessible_table_markdown, 5000);
  if (!tableText) return 0;
  const area = Math.max(1, Number(width ?? 0) * Number(height ?? 0));
  return Math.max(0, Math.min(1, tableText.length / Math.max(area / 65, 240)));
}

function visualBudgetClass(args: { sourceKind?: string | null; metadata: Record<string, unknown>; text: string }) {
  const candidate = compact(args.metadata.candidate_type).toLowerCase();
  const role = compact(args.metadata.table_role).toLowerCase();
  const text = args.text.toLowerCase();
  if (role === "admin" || role === "reference" || adminSignalPattern.test(text)) return "admin_reference" as const;
  if (args.sourceKind === "table_crop" || /table|threshold/.test(candidate)) return "clinical_table" as const;
  if (/flowchart|algorithm|decision|pathway/.test(candidate) || /flowchart|algorithm|next step|decision/.test(text))
    return "flowchart" as const;
  if (/risk matrix|matrix/.test(candidate) || /risk matrix|likelihood|consequence/.test(text)) return "risk_matrix" as const;
  if (/medication|dose|route/.test(candidate) || /\b(?:dose|route|mg|mcg|im|po)\b/.test(text))
    return "medication_chart" as const;
  if (/form|checklist/.test(candidate) || /checklist|tick box|required fields/.test(text)) return "form_checklist" as const;
  if (/graph|chart|axis|trend/.test(candidate) || /graph|chart|axis|trend/.test(text)) return "graph" as const;
  return clinicalSignalPattern.test(text) ? ("clinical_region" as const) : ("low_signal" as const);
}

export function scoreVisualCandidate(image: VisualCandidateInput): RankedVisualCandidate {
  const metadata = safeRecord(image.metadata);
  const tableText = compact(metadata.table_text ?? metadata.accessible_table_markdown ?? metadata.table_text_snippet, 2400);
  const nearbyText = compact(image.nearbyText, 1400);
  const text = [metadata.table_title, metadata.table_label, tableText, nearbyText].filter(Boolean).join(" ");
  const width = Number(image.width ?? 0);
  const height = Number(image.height ?? 0);
  const area = width * height;
  const imageQualityScore = clamp01(area > 0 ? Math.sqrt(Math.min(area, 900_000) / 900_000) : 0.55, 0.55);
  const cropCompleteness = clamp01(
    Number(metadata.crop_completeness ?? metadata.table_confidence ?? (image.sourceKind === "table_crop" ? 0.72 : 0.6)),
    0.6,
  );
  const ocrTextDensity = textDensity(metadata, width, height);
  const captionBudgetClass = visualBudgetClass({ sourceKind: image.sourceKind, metadata, text });
  const reasons: string[] = [];
  let score = 0.22 + imageQualityScore * 0.16 + cropCompleteness * 0.14 + ocrTextDensity * 0.18;
  if (image.sourceKind === "table_crop") {
    score += 0.22;
    reasons.push("table crop");
  }
  if (clinicalSignalPattern.test(text)) {
    score += 0.2;
    reasons.push("clinical text signal");
  }
  if (adminSignalPattern.test(text) || captionBudgetClass === "admin_reference") {
    score -= 0.35;
    reasons.push("admin/reference signal");
  }
  if (captionBudgetClass !== "low_signal" && captionBudgetClass !== "admin_reference") score += 0.14;
  if (metadata.table_rows && Array.isArray(metadata.table_rows)) score += 0.08;

  return {
    ...image,
    originalIndex: image.originalIndex ?? 0,
    candidatePriorityScore: Number(clamp01(score, 0).toFixed(3)),
    imageQualityScore: Number(imageQualityScore.toFixed(3)),
    cropCompleteness: Number(cropCompleteness.toFixed(3)),
    ocrTextDensity: Number(ocrTextDensity.toFixed(3)),
    captionBudgetClass,
    reasons,
    duplicateGroup: image.perceptualHash ?? image.imageHash ?? null,
  };
}

export function rankVisualCandidates(images: VisualCandidateInput[]) {
  return images
    .map((image, index) => scoreVisualCandidate({ ...image, originalIndex: image.originalIndex ?? index }))
    .sort(
      (a, b) =>
        b.candidatePriorityScore - a.candidatePriorityScore ||
        b.ocrTextDensity - a.ocrTextDensity ||
        a.originalIndex - b.originalIndex,
    );
}

export function selectCaptionCandidateIndexes(
  ranked: RankedVisualCandidate[],
  maxClinicalCaptions: number,
  maxPerPage: number,
) {
  const selected = new Set<number>();
  const selectedByPage = new Map<number | "unknown", number>();
  const classOrder: RankedVisualCandidate["captionBudgetClass"][] = [
    "clinical_table",
    "flowchart",
    "risk_matrix",
    "medication_chart",
    "form_checklist",
    "graph",
    "clinical_region",
  ];
  const addCandidate = (candidate: RankedVisualCandidate) => {
    if (selected.size >= maxClinicalCaptions) return;
    if (candidate.captionBudgetClass === "admin_reference" || candidate.captionBudgetClass === "low_signal") return;
    const pageKey = candidate.pageNumber ?? "unknown";
    const pageCount = selectedByPage.get(pageKey) ?? 0;
    if (pageCount >= maxPerPage) return;
    selected.add(candidate.originalIndex);
    selectedByPage.set(pageKey, pageCount + 1);
  };
  for (const budgetClass of classOrder) {
    const first = ranked.find(
      (candidate) => candidate.captionBudgetClass === budgetClass && !selected.has(candidate.originalIndex),
    );
    if (first) addCandidate(first);
  }
  for (const candidate of ranked) addCandidate(candidate);
  return selected;
}
