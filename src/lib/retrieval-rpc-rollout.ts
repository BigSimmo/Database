export type RetrievalRpcErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function isMissingRetrievalRpcError(error: RetrievalRpcErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42883" || error.code === "PGRST202") return true;
  if (error.code) return false;

  const message = error.message?.trim() ?? "";
  return (
    /\bfunction\s+[\w."-]+\s*\([^)]*\)\s+does not exist\b/i.test(message) ||
    /\bcould not find the function\b.*\bin the schema cache\b/i.test(message) ||
    /\bschema cache\b.*\bfunction\b.*\b(?:not found|missing)\b/i.test(message)
  );
}
