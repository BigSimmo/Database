export function safeIngestionJobLog(jobId: string) {
  return `Processing ingestion job ${jobId}`;
}

function redactLogValue(value: unknown) {
  if (typeof value !== "string") return value;
  const htmlTitle = value.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim();
  const normalizedValue = htmlTitle ? `HTML response: ${htmlTitle}` : value;
  return normalizedValue
    .replace(/\b[A-Za-z]:\\[^\s'")]+/g, "[path]")
    .replace(/\/(?:[^\s'")]+\/)+[^\s'")]+/g, "[path]")
    .replace(/https?:\/\/[^\s'")]+/g, "[url]")
    .replace(/\b(?:sk|pk|sbp|eyJ)[A-Za-z0-9._-]{12,}\b/g, "[secret]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .slice(0, 500);
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
