/** User request context only. Generated answers are never inputs to this contract. */
export type ResolvedAnswerRequestContext = Readonly<{
  version: "answer-request-context-v1";
  subject: string;
  constraints: readonly string[];
  latestRequest: string;
  depth: "concise" | "standard" | "detailed";
}>;

const marker = "Follow-up context v1: ";
const maxQueryLength = 2000;
const continuation =
  /\b(?:what about|how about|and (?:for|in|with|the)|also|same (?:for|with)|instead|as well|it|they|them|this|that|those|these)\b|\belaborate(?:\s+(?:with|further|more)\b|[.!?]*$)|\bexplain\s+(?:this|that|it|more)\b|\bexamples?\s+of (?:this|that)\b|^(?:please\s+)?(?:give|show|provide)(?:\s+me)?\s+(?:(?:an?|another)\s+)?examples?[.!?]*$/i;
const reset = /^(?:new (?:topic|question)|change (?:the )?topic|forget (?:that|the previous))\s*[:.-]?\s*/i;
const population = /\b(?:adults?|children|adolescents?|older people|elderly|pregnan\w*)\b/gi;
const elaborationOutputModifier =
  /\b(?:(?:in|with)\s+(?:(?:more|greater|further|full)\s+)?(?:detail|depth)|with\s+(?:(?:an?|another)\s+)?examples?)\b/gi;
const elaborationGrammarWord = /^(?:a|an|the|and|or|of|for|with|in|on)$/;
// Bare facets depend on the current subject; an additional named target does not.
const bareFacetContinuation = /^and\s+(?:dose|dosing|monitoring|management|risks?)[.!?]*$/i;

export function isAnswerRequestContextQuery(query: string) {
  // Also redact malformed/unknown versions, rather than leaking a rejected envelope.
  return /^(?:Follow-up context\b|Follow-up to ")/i.test(query.trim());
}

function depthFor(query: string): ResolvedAnswerRequestContext["depth"] {
  return /\b(?:elaborate|explain|examples?|detailed|in detail|comprehensive)\b/i.test(query)
    ? "detailed"
    : /\b(?:brief|briefly|concise|short)\b/i.test(query)
      ? "concise"
      : "standard";
}

/** Strictly parse only our bounded envelope; invalid input remains an ordinary full request. */
export function parseAnswerRequestContext(query: string): ResolvedAnswerRequestContext | null {
  if (query.length > maxQueryLength) return null;
  const legacy = /^Follow-up to "([^"\r\n]+)": ([\s\S]+)$/.exec(query);
  if (legacy)
    return {
      version: "answer-request-context-v1",
      subject: legacy[1],
      constraints: [],
      latestRequest: legacy[2],
      depth: depthFor(legacy[2]),
    };
  if (!query.startsWith(marker)) return null;
  try {
    const value: unknown = JSON.parse(query.slice(marker.length));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).sort().join() !== "constraints,depth,latestRequest,subject,version" ||
      record.version !== "answer-request-context-v1" ||
      typeof record.subject !== "string" ||
      !record.subject.trim() ||
      record.subject.length > 2000 ||
      typeof record.latestRequest !== "string" ||
      !record.latestRequest.trim() ||
      !Array.isArray(record.constraints) ||
      record.constraints.length > 4 ||
      record.constraints.some((item) => typeof item !== "string" || !item.trim() || item.length > 2000) ||
      !["concise", "standard", "detailed"].includes(String(record.depth))
    )
      return null;
    return {
      version: "answer-request-context-v1",
      subject: record.subject,
      constraints: [...record.constraints] as string[],
      latestRequest: record.latestRequest,
      depth: record.depth as ResolvedAnswerRequestContext["depth"],
    };
  } catch {
    return null;
  }
}

export function resolveAnswerRequestContext(
  priorQuery: string | undefined,
  latestRequest: string,
): ResolvedAnswerRequestContext {
  const latest = latestRequest.trim();
  if (latest.length > maxQueryLength) throw new RangeError("Answer request exceeds the query limit.");
  const prior = priorQuery?.trim();
  if (prior && prior.length > maxQueryLength)
    throw new RangeError("The prior answer request exceeds the context limit.");
  const priorContext = prior ? parseAnswerRequestContext(prior) : null;
  const elaborationTarget = /^(?:please\s+)?elaborate\s+on\s+([\s\S]+)/i.exec(latest)?.[1];
  const contextWords = new Set(
    [priorContext?.subject ?? prior ?? "", ...(priorContext?.constraints ?? []), priorContext?.latestRequest ?? ""]
      .join(" ")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  );
  // Separate bounded request grammar/output modifiers from the target. Every
  // remaining word must be a generic facet/reference or already in user context:
  // an anaphoric word elsewhere never overrides an unmatched explicit subject.
  const targetWords = (
    elaborationTarget
      ?.toLowerCase()
      .replace(elaborationOutputModifier, " ")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((word) => !elaborationGrammarWord.test(word));
  const dependentRequest = elaborationTarget
    ? targetWords.length > 0 &&
      targetWords.every(
        (word) =>
          /^(?:this|that|its|dose|dosing|monitoring|management|risk|risks)$/.test(word) || contextWords.has(word),
      )
    : continuation.test(latest) || bareFacetContinuation.test(latest);
  const newTopic = reset.test(latest) || !prior || !dependentRequest;
  if (newTopic) {
    const subject = latest.replace(reset, "");
    return {
      version: "answer-request-context-v1",
      subject,
      constraints: [],
      latestRequest: subject,
      depth: depthFor(latest),
    };
  }
  if (prior && isAnswerRequestContextQuery(prior) && !priorContext) throw new Error("Invalid prior answer context.");
  let subject = priorContext?.subject ?? prior;
  let retained = [...(priorContext?.constraints ?? [])];
  if (priorContext && priorContext.latestRequest !== priorContext.subject) retained.push(priorContext.latestRequest);
  if (latest.match(population)) {
    subject = subject.replace(population, "").replace(/\s+/g, " ").trim();
    retained = retained.map((item) => item.replace(population, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  if (/\b(?:normal renal|without renal impairment|no renal impairment)\b/i.test(latest)) {
    const removeImpairment = (value: string) =>
      value
        .replace(/\b(?:with\s+)?(?:(?:severe|moderate|mild)\s+)?renal (?:impairment|failure|dysfunction)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    subject = removeImpairment(subject);
    retained = retained.map(removeImpairment).filter(Boolean);
  }
  if (new Set(retained).size > 4) throw new RangeError("Too many retained answer constraints.");
  return {
    version: "answer-request-context-v1",
    subject,
    // Policy resets are ordered: keep each constraint at its latest occurrence.
    constraints: retained.filter((item, index) => retained.lastIndexOf(item) === index),
    latestRequest: latest,
    depth: depthFor(latest) === "standard" ? (priorContext?.depth ?? depthFor(prior)) : depthFor(latest),
  };
}

export function renderAnswerRequestContext(context: ResolvedAnswerRequestContext): string {
  if (context.subject === context.latestRequest && context.constraints.length === 0) return context.latestRequest;
  const query =
    context.constraints.length === 0 &&
    context.depth === depthFor(context.latestRequest) &&
    !context.subject.includes('"')
      ? `Follow-up to "${context.subject}": ${context.latestRequest}`
      : marker + JSON.stringify(context);
  // Never silently remove a meaningful latest request or retained constraint to fit transport.
  if (query.length > maxQueryLength) throw new RangeError("Resolved answer context exceeds the query limit.");
  return query;
}
