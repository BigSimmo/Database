/** Shared Python executable resolution for extraction and worker prerequisites. */
export function resolvePythonBin(explicit = process.env.PYTHON_BIN): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return process.platform === "win32" ? "python" : "python3";
}
