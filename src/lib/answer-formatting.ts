export type AnswerDisplayLine = {
  id: string;
  label: string | null;
  text: string;
  presentation: AnswerLinePresentation;
};

export type AnswerDisplayTone =
  | "direct"
  | "action"
  | "monitoring"
  | "medication"
  | "risk"
  | "documentation"
  | "gap"
  | "comparison"
  | "source"
  | "summary";

export type AnswerLinePresentation = {
  tone: AnswerDisplayTone;
  symbol: string;
  label: string;
};

export type AnswerDisplayMode = "direct" | "checklist" | "clinical_pathway" | "comparison" | "summary" | "evidence_gap";

export type ParsedAnswerDisplay =
  | { type: "paragraph"; lines: AnswerDisplayLine[]; mode: AnswerDisplayMode }
  | { type: "bullets"; lines: AnswerDisplayLine[]; mode: AnswerDisplayMode };

const knownAnswerLabels = new Set([
  "bottom line",
  "required actions",
  "monitoring",
  "monitoring/timing",
  "medication/dose details",
  "dose detail",
  "medication point",
  "table evidence",
  "threshold/action",
  "risk/escalation",
  "escalation/risk",
  "workflow step",
  "documentation/forms",
  "source gaps",
  "section summary",
  "source point",
]);

function normalizeInline(value: string) {
  return value.replace(/[ \t]+/g, " ").trim();
}

function stripBulletPrefix(value: string) {
  return value.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function splitInlineBullets(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const newlineParts = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (newlineParts.filter((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line)).length >= 2) {
    return newlineParts.map(stripBulletPrefix);
  }

  const inlineParts = trimmed
    .split(/(?:^|\s)-\s+(?=(?:\*\*)?[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (inlineParts.length >= 2) return inlineParts;

  return [trimmed];
}

function splitLabel(value: string): Pick<AnswerDisplayLine, "label" | "text"> {
  const match = value.match(/^([^:]{2,44}):\s+(.+)$/);
  if (!match) return { label: null, text: value };

  const rawLabel = normalizeInline(match[1].replace(/\*\*/g, ""));
  const labelKey = rawLabel.toLowerCase();
  if (!knownAnswerLabels.has(labelKey) && !/^[A-Z][A-Za-z/ -]{2,40}$/.test(rawLabel)) {
    return { label: null, text: value };
  }

  return {
    label: rawLabel,
    text: normalizeInline(match[2]),
  };
}

function inferPresentation(label: string | null, text: string): AnswerLinePresentation {
  const labelKey = (label ?? "").toLowerCase();
  if (/\bbottom line\b/.test(labelKey)) {
    return { tone: "direct", symbol: "✓", label: label ?? "Bottom line" };
  }
  if (/\b(?:source gaps?|gap|unsupported)\b/.test(labelKey)) {
    return { tone: "gap", symbol: "?", label: label ?? "Source gap" };
  }
  if (/\b(?:risk|escalation|red flag|safety)\b/.test(labelKey)) {
    return { tone: "risk", symbol: "!", label: label ?? "Risk" };
  }
  if (/\b(?:medication|dose|titration|prescrib)\b/.test(labelKey)) {
    return { tone: "medication", symbol: "Rx", label: label ?? "Medication" };
  }
  if (/\b(?:monitoring|timing|threshold|table evidence)\b/.test(labelKey)) {
    return { tone: "monitoring", symbol: "⏱", label: label ?? "Monitoring" };
  }
  if (/\b(?:required actions?|workflow|action)\b/.test(labelKey)) {
    return { tone: "action", symbol: "→", label: label ?? "Action" };
  }
  if (/\b(?:documentation|forms?|record|audit)\b/.test(labelKey)) {
    return { tone: "documentation", symbol: "§", label: label ?? "Document" };
  }
  if (/\b(?:compare|comparison|conflict)\b/.test(labelKey)) {
    return { tone: "comparison", symbol: "↔", label: label ?? "Compare" };
  }
  if (/\b(?:source|citation|quote|evidence)\b/.test(labelKey)) {
    return { tone: "source", symbol: "#", label: label ?? "Source" };
  }
  if (/\b(?:summary|overview|section summary)\b/.test(labelKey)) {
    return { tone: "summary", symbol: "•", label: label ?? "Summary" };
  }

  const combined = text.toLowerCase();
  if (/\b(?:gap|insufficient|unsupported|not contain|not enough|unclear|missing)\b/.test(combined)) {
    return { tone: "gap", symbol: "?", label: label ?? "Source gap" };
  }
  if (/\b(?:risk|escalat|urgent|immediate|red flag|cease|withhold|stop|contraindicat|avoid|emergency)\b/.test(combined)) {
    return { tone: "risk", symbol: "!", label: label ?? "Risk" };
  }
  if (/\b(?:monitor|timing|weekly|monthly|hours?|days?|weeks?|anc|fbc|wbc|blood test|threshold|level)\b/.test(combined)) {
    return { tone: "monitoring", symbol: "⏱", label: label ?? "Monitoring" };
  }
  if (/\b(?:dose|mg|mcg|route|oral|intramuscular|im\b|po\b|clozapine|lithium|lorazepam|haloperidol|olanzapine|medication)\b/.test(combined)) {
    return { tone: "medication", symbol: "Rx", label: label ?? "Medication" };
  }
  if (/\b(?:document|form|record|audit|consent|register|file|note)\b/.test(combined)) {
    return { tone: "documentation", symbol: "§", label: label ?? "Document" };
  }
  if (/\b(?:compare|versus|difference|whereas|while|document-specific|conflict)\b/.test(combined)) {
    return { tone: "comparison", symbol: "↔", label: label ?? "Compare" };
  }
  if (/\b(?:source|citation|quote|evidence|excerpt)\b/.test(combined)) {
    return { tone: "source", symbol: "#", label: label ?? "Source" };
  }
  if (/\b(?:action|required|must|should|complete|refer|review|arrange|contact|notify|assess)\b/.test(combined)) {
    return { tone: "action", symbol: "→", label: label ?? "Action" };
  }
  if (/\b(?:summary|overview|bottom line|key point)\b/.test(combined)) {
    return { tone: "summary", symbol: "•", label: label ?? "Summary" };
  }
  return { tone: "direct", symbol: "✓", label: label ?? "Point" };
}

function inferDisplayMode(lines: AnswerDisplayLine[]): AnswerDisplayMode {
  const presentations = lines.map((line) => line.presentation);
  if (presentations.some((item) => item.tone === "gap")) return "evidence_gap";
  if (presentations.some((item) => item.tone === "comparison")) return "comparison";
  if (presentations.some((item) => item.tone === "risk" || item.tone === "medication" || item.tone === "monitoring")) {
    return "clinical_pathway";
  }
  if (lines.length >= 2 && presentations.some((item) => item.tone === "action" || item.tone === "documentation")) {
    return "checklist";
  }
  if (lines.length >= 3) return "summary";
  return "direct";
}

export function answerLinePresentation(line: AnswerDisplayLine): AnswerLinePresentation {
  return line.presentation ?? inferPresentation(line.label, line.text);
}

function buildAnswerLine(part: string, index: number, prefix: string): AnswerDisplayLine {
  const parsed = splitLabel(part);
  return {
    id: `${prefix}:${index}:${part.slice(0, 48)}`,
    ...parsed,
    presentation: inferPresentation(parsed.label, parsed.text),
  };
}

export function parseAnswerDisplayContent(value: string): ParsedAnswerDisplay {
  const cleaned = value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) {
    return {
      type: "paragraph",
      mode: "evidence_gap",
      lines: [
        {
          id: "empty",
          label: null,
          text: "No usable answer text for this result.",
          presentation: inferPresentation(null, "No usable answer text for this result."),
        },
      ],
    };
  }

  const parts = splitInlineBullets(cleaned)
    .map((part) => normalizeInline(part))
    .filter((part) => part.length > 0);

  if (parts.length >= 2) {
    const lines = parts.map((part, index) => buildAnswerLine(part, index, "bullet"));
    return {
      type: "bullets",
      mode: inferDisplayMode(lines),
      lines,
    };
  }

  const semicolonParts = cleaned
    .split(/\s*;\s*/)
    .map((part) => normalizeInline(part))
    .filter((part) => part.length > 18);
  if (semicolonParts.length >= 3) {
    const lines = semicolonParts.map((part, index) => buildAnswerLine(part, index, "semicolon"));
    return {
      type: "bullets",
      mode: inferDisplayMode(lines),
      lines,
    };
  }

  const lines = [buildAnswerLine(normalizeInline(cleaned), 0, "paragraph")];
  return {
    type: "paragraph",
    mode: inferDisplayMode(lines),
    lines,
  };
}
