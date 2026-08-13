import http from "node:http";

const defaultSleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

/** Perform one bounded GET attempt and return its completed response, or null. */
export function requestText(url, timeoutMs, client = http) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError(`HTTP request timeout must be positive; received ${timeoutMs}.`);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    let request = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      resolve(result);
    };

    try {
      request = client.get(url, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => finish({ statusCode: response.statusCode, body }));
        response.on("aborted", () => finish(null));
        response.on("error", () => finish(null));
        response.on("close", () => {
          if (!response.complete) finish(null);
        });
      });
    } catch {
      finish(null);
      return;
    }

    request.on("error", () => finish(null));
    timeout = setTimeout(() => {
      finish(null);
      request.destroy();
    }, timeoutMs);
  });
}

/** Poll a bounded HTTP request until its response passes the readiness predicate. */
export async function waitForHttpReadiness({
  url,
  isReady,
  hasExited = () => false,
  timeoutMs,
  requestTimeoutMs = 5_000,
  pollIntervalMs = 500,
  exitErrorMessage = "server exited before becoming ready",
  timeoutErrorMessage = `server did not become ready within ${timeoutMs}ms`,
  now = Date.now,
  sleep = defaultSleep,
  request = requestText,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError(`Readiness timeout must be positive; received ${timeoutMs}.`);
  }
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new TypeError(`Readiness request timeout must be positive; received ${requestTimeoutMs}.`);
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new TypeError(`Readiness poll interval cannot be negative; received ${pollIntervalMs}.`);
  }

  const deadline = now() + timeoutMs;
  while (true) {
    if (hasExited()) throw new Error(exitErrorMessage);
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error(timeoutErrorMessage);

    const result = await request(url, Math.max(1, Math.min(requestTimeoutMs, remaining)));
    if (result && isReady(result)) return;

    const delayMs = Math.min(pollIntervalMs, Math.max(0, deadline - now()));
    if (delayMs > 0) await sleep(delayMs);
  }
}
