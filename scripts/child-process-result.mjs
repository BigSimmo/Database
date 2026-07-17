export function childProcessExitCode(result) {
  if (Number.isInteger(result?.status)) return result.status;
  return 1;
}

export function childProcessFailureSummary(result) {
  const details = [];
  if (typeof result?.status === "number") details.push(`status ${result.status}`);
  else details.push("missing exit status");
  if (result?.signal) details.push(`signal ${result.signal}`);
  if (result?.error) details.push(`launch error: ${result.error.message ?? String(result.error)}`);
  return details.join(", ");
}
