import type { ClinicalAskFinalPayload, ClinicalAskRequest, ClinicalAskStreamEvent } from "@/lib/clinical-ask/contracts";
import { parseClinicalAskSseFrame } from "@/lib/clinical-ask-stream-contract";

function failedPayload(request: ClinicalAskRequest, code: "aborted" | "internal_error"): ClinicalAskFinalPayload {
  return {
    response: {
      state: "failed",
      mode: request.mode,
      code,
      retryable: code !== "aborted",
      message: code === "aborted" ? "Clinical Ask was cancelled." : "Clinical Ask stream could not be read.",
    },
    feedback: null,
  };
}

export async function streamClinicalAsk(
  request: ClinicalAskRequest,
  signal: AbortSignal,
  onEvent: (event: ClinicalAskStreamEvent) => void,
): Promise<ClinicalAskFinalPayload> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch("/api/clinical-ask/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return failedPayload(request, "internal_error");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal: ClinicalAskFinalPayload | null = null;
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame.trim()) continue;
        const event = parseClinicalAskSseFrame(`${frame}\n\n`);
        if (!event) continue;
        if (terminal) throw new Error("Clinical Ask stream sent data after its terminal event.");
        onEvent(event);
        if (event.type === "final") terminal = event.payload;
        if (event.type === "error") {
          terminal = {
            response: {
              state: "failed",
              mode: request.mode,
              code: event.code,
              retryable: event.retryable,
              message: event.message,
            },
            feedback: null,
          };
        }
      }
      if (done) break;
    }
    if (!terminal) throw new Error("Clinical Ask stream ended without a terminal event.");
    return terminal;
  } catch {
    controller.abort();
    return failedPayload(request, signal.aborted ? "aborted" : "internal_error");
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
