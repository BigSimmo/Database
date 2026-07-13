import "server-only";

import { PublicApiError } from "@/lib/http";

type AdmissionState = { active: number; bytes: number };
type GlobalWithUploadAdmission = typeof globalThis & { __clinicalKbUploadAdmission?: AdmissionState };

// Best-effort load shedding per Node process/instance. A shared atomic store is
// required if deployment-wide concurrency or byte ceilings become necessary.
const state = ((globalThis as GlobalWithUploadAdmission).__clinicalKbUploadAdmission ??= { active: 0, bytes: 0 });

export function parseUploadContentLength(value: string | null) {
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new PublicApiError("Invalid Content-Length header.", 400, { code: "invalid_content_length" });
  }
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes)) {
    throw new PublicApiError("Invalid Content-Length header.", 400, { code: "invalid_content_length" });
  }
  return bytes;
}

export function acquireUploadAdmission(args: {
  bytes: number;
  maxConcurrent: number;
  maxBytes: number;
}): { ok: true; release: () => void } | { ok: false; reason: "concurrency" | "bytes" } {
  if (state.active >= args.maxConcurrent) return { ok: false, reason: "concurrency" };
  if (state.bytes + args.bytes > args.maxBytes) return { ok: false, reason: "bytes" };
  state.active += 1;
  state.bytes += args.bytes;
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      state.active -= 1;
      state.bytes -= args.bytes;
    },
  };
}

export function resetUploadAdmissionForTests() {
  state.active = 0;
  state.bytes = 0;
}
