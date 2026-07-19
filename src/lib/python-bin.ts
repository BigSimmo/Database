/** Shared Python executable resolution for extraction and worker prerequisites. */
export function resolvePythonBin(explicit = process.env.PYTHON_BIN): string {
  if (explicit && explicit.trim().length > 0) return explicit;
  return process.platform === "win32" ? "python" : "python3";
}
