/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClinicalAskSpeech } from "@/components/clinical-dashboard/use-clinical-ask-speech";

const track = { stop: vi.fn() };
class FakeRecorder {
  static isTypeSupported = () => true;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType: string;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "audio/webm";
    instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.();
  }
}
const instances: FakeRecorder[] = [];

beforeEach(() => {
  instances.length = 0;
  track.stop.mockClear();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
  });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transcript: "Editable synthetic transcript" }) }),
  );
});

describe("useClinicalAskSpeech", () => {
  it("records only after start, stops explicitly, and leaves an editable transcript without submitting", async () => {
    const { result } = renderHook(() => useClinicalAskSpeech());
    expect(fetch).not.toHaveBeenCalled();
    await act(() => result.current.start());
    expect(result.current.state).toBe("listening");
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state).toBe("ready_to_review"));
    expect(result.current.transcript).toBe("Editable synthetic transcript");
    act(() => result.current.setTranscript("Edited transcript"));
    expect(result.current.transcript).toBe("Edited transcript");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalled();
  });

  it("reports permission denial and unsupported browsers without upload", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    const denied = renderHook(() => useClinicalAskSpeech());
    await act(() => denied.result.current.start());
    expect(denied.result.current.state).toBe("permission_denied");
    denied.unmount();
    vi.stubGlobal("MediaRecorder", undefined);
    const unsupported = renderHook(() => useClinicalAskSpeech());
    await act(() => unsupported.result.current.start());
    expect(unsupported.result.current.state).toBe("unsupported");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("aborts and disposes tracks on cancel and unmount", async () => {
    const hook = renderHook(() => useClinicalAskSpeech());
    await act(() => hook.result.current.start());
    act(() => hook.result.current.cancel());
    expect(hook.result.current.state).toBe("cancelled");
    expect(track.stop).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    hook.unmount();
  });

  it("stops a media stream that resolves after cancellation", async () => {
    const lateTrack = { stop: vi.fn() };
    let resolvePermission!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(
      new Promise<MediaStream>((resolve) => {
        resolvePermission = resolve;
      }),
    );
    const hook = renderHook(() => useClinicalAskSpeech());
    let startPromise!: Promise<void>;
    act(() => {
      startPromise = hook.result.current.start() as Promise<void>;
    });
    expect(hook.result.current.state).toBe("requesting_permission");
    act(() => hook.result.current.cancel());
    await act(async () => {
      resolvePermission({ getTracks: () => [lateTrack] } as unknown as MediaStream);
      await startPromise;
    });
    expect(lateTrack.stop).toHaveBeenCalledOnce();
    expect(hook.result.current.state).toBe("cancelled");
    expect(instances).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains only the in-memory blob for one editable retry", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: "Retried transcript" }) } as Response);
    const { result } = renderHook(() => useClinicalAskSpeech());
    await act(() => result.current.start());
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.canRetry).toBe(true);
    act(() => result.current.retryTranscription());
    await waitFor(() => expect(result.current.state).toBe("ready_to_review"));
    expect(result.current.transcript).toBe("Retried transcript");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("hard-stops an oversized in-memory recording without upload", async () => {
    const { result } = renderHook(() => useClinicalAskSpeech());
    await act(() => result.current.start());
    act(() => instances[0]?.ondataavailable?.({ data: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]) } as BlobEvent));
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(fetch).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});
