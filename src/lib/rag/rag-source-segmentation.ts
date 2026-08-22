const numberedSourceHeadingPattern = /^(?:\d+(?:\.\d+)+\.?|\d{1,2}\.)\s+[A-Z]/;
const sourceBulletLinePattern = /^[•*\-–—]\s+/;
const wrappedEscalationActionLinePattern =
  /\b(?:must|should|needs?\s+to|is\s+to|are\s+to|required\s+to)\s+(?:(?:promptly|urgently|immediately|directly|also|then)\s+){0,2}(?:be\s+)?escalat(?:e|ed)\s*$/i;
const wrappedEscalationRecipientLinePattern =
  /^to\s+(?:the\s+)?(?:(?:treating|responsible|senior|on[-\s]?call)\s+(?:doctor|clinician|medical\s+officer|prescriber)|(?:treating|responsible|senior|on[-\s]?call|medical|clinical)\s+team|prescriber)\b/i;
const wrappedEctBookingLeadLinePattern =
  /\bfollowing\s+receipt\s+of\s+(?:(?:an?\s+)?ECT\s+)?referral,?\s+the\s+ECT\s+Coordinator\s+places\s+the\s+patient\s+onto\s+the\s*$/i;
const wrappedEctBookingSystemLinePattern = /^Booking\s+Assistant\s+Scheduling\s+Engine(?:\s*\(BASE\))?\b/i;
const wrappedAgitationOlanzapineLeadPattern = /\bOlanzapine\s+IM\b[^\n]*\bafter\s+the\s*$/i;
const wrappedAgitationOlanzapineContinuationPattern =
  /^first\s+dose\s+if\s+required\.\s+Total\s+of\s+3\s+doses\s+or\s+30\s*mg\b/i;
const wrappedAgitationOlderAdultLeadPattern = /\b30\s*mg\s+maximum\s+in\s+24\s+hours\s*\(10\s*mg\s*$/i;
const wrappedAgitationOlderAdultContinuationPattern =
  /^maximum\s+in\s+24\s+hours\s+for\s+older\s+adults\s+over\s+65\s+years\)\s+whichever\s+occurs\s+first\.\s*$/i;
const wrappedAgitationConsultantLeadPattern =
  /\bDosing\s+frequencies\s+outside\s+the\s+recommended\s+guidelines\s+require\s+Consultant\s*$/i;
const wrappedAgitationConsultantContinuationPattern = /^Psychiatrist\s+approval\.\s*$/i;

/** Rejoin a PDF visual wrap that separates an escalation action from its clinical recipient. */
export function reflowWrappedEscalationRecipientLines(value: string) {
  const reflowed: string[] = [];
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const previous = reflowed.at(-1)?.trim() ?? "";
    if (
      line &&
      previous &&
      wrappedEscalationActionLinePattern.test(previous) &&
      wrappedEscalationRecipientLinePattern.test(line)
    ) {
      reflowed[reflowed.length - 1] = `${previous} ${line}`;
      continue;
    }
    reflowed.push(rawLine);
  }
  return reflowed.join("\n");
}

/** Rejoin the observed FSH ECT booking-system name when PDF wrapping splits its governing directive. */
export function reflowWrappedEctBookingSystemLines(value: string) {
  const reflowed: string[] = [];
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const previous = reflowed.at(-1)?.trim() ?? "";
    if (
      line &&
      previous &&
      wrappedEctBookingLeadLinePattern.test(previous) &&
      wrappedEctBookingSystemLinePattern.test(line)
    ) {
      reflowed[reflowed.length - 1] = `${previous} ${line}`;
      continue;
    }
    reflowed.push(rawLine);
  }
  return reflowed.join("\n");
}

/** Rejoin the observed EMHS agitation-dose bullet continuations without crossing bullet boundaries. */
export function reflowWrappedAgitationDoseLines(value: string) {
  const reflowed: string[] = [];
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const previous = reflowed.at(-1)?.trim() ?? "";
    const joinsObservedContinuation =
      (wrappedAgitationOlanzapineLeadPattern.test(previous) &&
        wrappedAgitationOlanzapineContinuationPattern.test(line)) ||
      (wrappedAgitationOlderAdultLeadPattern.test(previous) &&
        wrappedAgitationOlderAdultContinuationPattern.test(line)) ||
      (wrappedAgitationConsultantLeadPattern.test(previous) &&
        wrappedAgitationConsultantContinuationPattern.test(line));
    if (line && previous && joinsObservedContinuation) {
      reflowed[reflowed.length - 1] = `${previous} ${line}`;
      continue;
    }
    reflowed.push(rawLine);
  }
  return reflowed
    .join("\n")
    .replace(/\b(first\s+dose\s+if\s+required)\.\s+(Total\s+of\s+3\s+doses\s+or\s+30\s*mg\b)/gi, "$1 — $2");
}

/**
 * Reflow OCR/PDF visual line wraps without joining across semantic source
 * boundaries. Blank lines, bullets, terminal punctuation, colons, and numbered
 * headings remain hard boundaries.
 *
 * With `requireContinuationStart`, a line additionally joins the previous one
 * only when it visibly continues its sentence (starts with a lowercase letter,
 * digit, or opening parenthesis). Capitalized lines then start a new block:
 * joining separate capitalized items ("Stop clozapine" / "Starting dose
 * 12.5 mg") would manufacture claim support from unrelated source lines. The
 * default keeps the historical aggressive join for the sanitized policy-source
 * and table-row callers, whose known texts wrap across capitalized proper
 * nouns ("…Emergency\nDepartment (AHS-ED)…").
 */
const wrapContinuationLineStartPattern = /^[a-z0-9(]/;

export function reflowBoundedSourceLines(value: string, options?: { requireContinuationStart?: boolean }) {
  const requireContinuationStart = options?.requireContinuationStart ?? false;
  const blocks: string[] = [];
  let wrappedLines: string[] = [];
  const flush = () => {
    if (wrappedLines.length === 0) return;
    blocks.push(wrappedLines.join(" "));
    wrappedLines = [];
  };

  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (numberedSourceHeadingPattern.test(line)) {
      flush();
      blocks.push(line);
      continue;
    }
    if (sourceBulletLinePattern.test(line)) flush();
    if (requireContinuationStart && wrappedLines.length > 0 && !wrapContinuationLineStartPattern.test(line)) flush();
    wrappedLines.push(line);
    if (/[.!?]\s*$/.test(line) || /:\s*$/.test(line)) flush();
  }
  flush();
  return blocks;
}

/**
 * Recover the complete red-range row from the reviewed NMHS clozapine table.
 *
 * The PDF extractor places the WBC/action and neutrophil/contact cells on
 * consecutive visual lines, with sentence punctuation between them. This
 * helper is deliberately source-labelled and requires every row atom before
 * returning a segment, so consumers can treat the row atomically without
 * joining partial rows or different documents.
 */
export function atomicNmhsClozapineRedRangeSegment(args: { sourceLabel: string; content: string }) {
  if (!/\bclozapine prescribing\b.*\bnmhs\b/i.test(args.sourceLabel)) return null;
  const text = reflowBoundedSourceLines(args.content).join(" ").replace(/\s+/g, " ").trim();
  const unit = String.raw`(?:x|×)\s*10\s*9\s*\/\s*L`;
  const rowPattern = new RegExp(
    String.raw`\b(WBC\s*<\s*3(?:\.0)?\s*${unit})\b\s*AND\/OR\s*Stop clozapine therapy immediately\.\s*Red Range\s+(Neutrophils\s*<\s*1\.5\s*${unit})\b\s*Contact haematologist and Clozapine Monitoring\s+Centre\b`,
    "i",
  );
  const match = text.match(rowPattern);
  if (!match) return null;
  // Re-express the flattened cells in their semantic row order. The values and
  // directives remain verbatim captures; the colon makes the shared action
  // binding explicit to the ordinary claim-support machinery.
  return `${match[1]} AND/OR Red Range ${match[2]}: Stop clozapine therapy immediately. Contact haematologist and Clozapine Monitoring Centre.`;
}
