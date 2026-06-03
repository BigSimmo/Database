function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  const acronyms = new Set(["anc", "fbc", "ecg", "ipu", "nsaids", "covid"]);
  return normalize(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => (acronyms.has(word) ? word.toUpperCase() : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`))
    .join(" ");
}

function canonicalTag(label: string, context: string) {
  const normalized = normalize(label);
  const normalizedContext = normalize(context);

  if (!normalized) return "";
  if (normalized === "roles" || normalized === "responsibilities") {
    if (/\b(clozapine|care coordinator|psychiatrist|clinic|monitoring)\b/.test(normalizedContext)) {
      return "Care team responsibilities";
    }
    return "Roles and responsibilities";
  }
  if (normalized === "role" || normalized === "responsibility") return "Roles and responsibilities";
  if (normalized === "care coordinator" || normalized === "care coordination") return "Care coordination";
  if (normalized === "psychiatrist" || normalized === "consultant psychiatrist") return "Psychiatrist review";
  if (normalized === "clozapine monitoring") return "Clozapine monitoring";
  if (normalized === "clozapine clinic") return "Clozapine clinic";
  if (normalized === "administration clerical" || normalized === "administration") return "Clinic administration";
  if (normalized === "blood test" || normalized === "blood tests") return "Blood test monitoring";
  if (normalized === "dose" || normalized === "dosing") return "Dose adjustment";
  if (normalized === "monitoring")
    return normalizedContext.includes("clozapine") ? "Clozapine monitoring" : "Monitoring";

  return titleCase(normalized);
}

function tagPriority(tag: string) {
  const normalized = normalize(tag);
  if (/\b(clozapine|lithium|medication|dose|blood test|monitoring|anc|fbc)\b/.test(normalized)) return 0;
  if (/\b(escalation|risk|urgent|review|psychiatrist)\b/.test(normalized)) return 1;
  if (/\b(care coordination|care team|workflow|clinic)\b/.test(normalized)) return 2;
  if (/\b(administration|document|version|authorisation|publication)\b/.test(normalized)) return 5;
  return 3;
}

export function smartEvidenceTags(
  labels: Array<string | null | undefined> | null | undefined,
  context = "",
  limit = 5,
) {
  const rawLabels = (labels ?? []).filter((label): label is string => Boolean(label?.trim()));
  const canonical = rawLabels
    .map((label, index) => ({ tag: canonicalTag(label, context), index }))
    .filter((item) => item.tag);
  const hasCareTeamResponsibilities = canonical.some((item) => item.tag === "Care team responsibilities");
  const deduped = new Map<string, { tag: string; index: number }>();

  for (const item of canonical) {
    if (hasCareTeamResponsibilities && item.tag === "Roles and responsibilities") continue;
    const key = normalize(item.tag);
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return [...deduped.values()]
    .sort((a, b) => tagPriority(a.tag) - tagPriority(b.tag) || a.index - b.index || a.tag.localeCompare(b.tag))
    .slice(0, limit)
    .map((item) => item.tag);
}
