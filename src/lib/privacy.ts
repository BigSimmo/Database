export function safeIngestionJobLog(jobId: string) {
  return `Processing ingestion job ${jobId}`;
}

function redactLogValue(value: unknown): unknown {
  if (typeof value !== "string") {
    // Audit L12: non-string code/details/hint fields (objects/arrays from
    // non-standard error shapes) used to pass through verbatim, skipping the
    // path/url/secret/email redaction below. Serialize them (guarded) and
    // redact the serialized form; primitives stay as-is.
    if (value === null || value === undefined) return value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    try {
      return redactLogValue(JSON.stringify(value) ?? "[unserializable]");
    } catch {
      return "[unserializable]";
    }
  }
  const htmlTitle = value.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim();
  const normalizedValue = htmlTitle ? `HTML response: ${htmlTitle}` : value;
  return (
    normalizedValue
      .replace(/\b[A-Za-z]:\\[^\s'\")]+/g, "[path]")
      .replace(/\/(?:[^\s'\")]+\/)+[^\s'\")]+/g, "[path]")
      .replace(/https?:\/\/[^\s'\")]+/g, "[url]")
      // Redact common secret/token formats, including modern Supabase keys like sb_secret_ and sb_publishable_
      .replace(/\b(?:sk|pk|sbp|sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9._-]{8,}\b/g, "[secret]")
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
      .slice(0, 500)
  );
}

export function safeErrorLogDetails(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : record.message;
  const stack = error instanceof Error ? error.stack : typeof record.stack === "string" ? record.stack : null;
  const errorName = error instanceof Error ? error.name : typeof error;
  const firstStackLine = stack
    ?.split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !line.startsWith("Error:") &&
        !line.startsWith(`${errorName}:`) &&
        !/^<(!doctype|html|head|body|!--)/i.test(line),
    );

  return {
    name: errorName,
    ...(message ? { message: redactLogValue(message) } : {}),
    ...(record.code ? { code: redactLogValue(record.code) } : {}),
    ...(record.details ? { details: redactLogValue(record.details) } : {}),
    ...(record.hint ? { hint: redactLogValue(record.hint) } : {}),
    ...(firstStackLine ? { stack: redactLogValue(firstStackLine) } : {}),
  };
}

export function redactCaptionIdentifiers(value: string): string {
  const clinicalRangePattern = /^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?(?:\s*[A-Za-zµ/%][\w/%.-]*)?$/i;
  return value
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\b(?:mrn|nhs)\s*[:#-]?\s*([0-9]+(?:[ \-][0-9]+)+|[A-Za-z0-9-]{4,})\b/gi, (match, idPart: string) => {
      const trimmed = idPart.replace(/\s+/g, " ").trim();
      // Count digits only; require at least 4 digits to consider it an identifier (avoids short numeric ranges).
      const digitCount = trimmed.replace(/\D/g, "").length;
      if (digitCount > 0 && digitCount < 4) return match;
      return "[id]";
    })
    .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 8 && !clinicalRangePattern.test(match.trim()) ? "[phone]" : match;
    });
}
