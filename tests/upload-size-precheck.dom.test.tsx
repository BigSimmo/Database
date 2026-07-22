import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UploadPanel } from "@/components/clinical-dashboard/DocumentManagerPanel";
import { MAX_UPLOAD_MB_CEILING } from "@/lib/upload-limits";

// The upload API caps every file at env.MAX_UPLOAD_MB, which its schema can
// never raise above MAX_UPLOAD_MB_CEILING (src/lib/env.ts). Without a browser
// pre-check an over-ceiling file is transferred in full before the server
// answers 413 — on a large guideline PDF over a clinic connection that is a
// long wait for a guaranteed rejection. These tests pin that the pre-check
// fires locally (using NEXT_PUBLIC_MAX_UPLOAD_MB when set, else the ceiling),
// that it does NOT swallow files the effective client limit still accepts,
// and that a mixed batch still uploads its valid files. The server remains
// the authority via env.MAX_UPLOAD_MB for anything that reaches /api/upload.

type OpenedRequest = { method: string; url: string };

const opened: OpenedRequest[] = [];

class FakeXhr {
  static lastStatus = 200;
  static lastResponse = JSON.stringify({ document: { id: "doc-1" }, job: { id: "job-1" } });

  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";

  open(method: string, url: string) {
    opened.push({ method, url });
  }
  setRequestHeader() {}
  abort() {}
  send() {
    this.status = FakeXhr.lastStatus;
    this.responseText = FakeXhr.lastResponse;
    // Resolve on a microtask so the component's await actually suspends first.
    queueMicrotask(() => this.onload?.());
  }
}

function fileOfSize(name: string, megabytes: number): File {
  // Allocating the real bytes would cost hundreds of MB; only `size` is read.
  const file = new File(["stub"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: Math.round(megabytes * 1024 * 1024) });
  return file;
}

function renderPanel() {
  const onUploaded = vi.fn();
  render(
    <UploadPanel
      onUploaded={onUploaded}
      demoMode={false}
      canUpload
      authorizationHeader={{ Authorization: "Bearer t" }}
    />,
  );
  return { onUploaded };
}

function selectFiles(files: File[]) {
  const input = screen.getByLabelText(/Guideline PDF files/i);
  fireEvent.change(input, { target: { files } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Upload guidelines" }));
}

beforeEach(() => {
  opened.length = 0;
  FakeXhr.lastStatus = 200;
  FakeXhr.lastResponse = JSON.stringify({ document: { id: "doc-1" }, job: { id: "job-1" } });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("upload size pre-check", () => {
  it("surfaces the limit on the file field before anything is selected", () => {
    renderPanel();
    const hint = screen.getByText(`PDF only, up to ${MAX_UPLOAD_MB_CEILING} MB per file.`);
    expect(hint).toBeVisible();
    // The limit must be announced to assistive tech from the input itself, not
    // just sit next to it as visual text.
    const input = screen.getByLabelText(/Guideline PDF files/i);
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("rejects an over-ceiling file locally, without opening a request", async () => {
    const { onUploaded } = renderPanel();
    selectFiles([fileOfSize("huge-guideline.pdf", MAX_UPLOAD_MB_CEILING + 1)]);
    submit();

    expect(await screen.findByText(/huge-guideline\.pdf/)).toHaveTextContent(
      `File exceeds ${MAX_UPLOAD_MB_CEILING} MB upload limit.`,
    );
    expect(opened).toHaveLength(0);
    // A batch with no accepted file must not claim the library changed.
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("still uploads a file at the ceiling — the server owns the real limit", async () => {
    const { onUploaded } = renderPanel();
    selectFiles([fileOfSize("at-limit.pdf", MAX_UPLOAD_MB_CEILING)]);
    submit();

    expect(await screen.findByText(/queued for indexing/)).toBeVisible();
    expect(opened).toEqual([{ method: "POST", url: "/api/upload" }]);
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("uploads the valid files in a mixed batch and reports the skipped one", async () => {
    renderPanel();
    selectFiles([fileOfSize("huge-guideline.pdf", MAX_UPLOAD_MB_CEILING * 2), fileOfSize("ok-guideline.pdf", 2)]);
    submit();

    const status = await screen.findByText(/Upload complete/);
    expect(status).toHaveTextContent("1 accepted; 1 failed");
    expect(status).toHaveTextContent(`huge-guideline.pdf: File exceeds ${MAX_UPLOAD_MB_CEILING} MB upload limit.`);
    // Exactly one request: the oversized file never reached the network.
    expect(opened).toHaveLength(1);
  });

  it("honours a lowered NEXT_PUBLIC_MAX_UPLOAD_MB for the hint and pre-check", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAX_UPLOAD_MB", "50");
    const { onUploaded } = renderPanel();

    expect(screen.getByText("PDF only, up to 50 MB per file.")).toBeVisible();

    selectFiles([fileOfSize("mid-guideline.pdf", 51)]);
    submit();

    expect(await screen.findByText(/mid-guideline\.pdf/)).toHaveTextContent(
      "File exceeds 50 MB upload limit.",
    );
    expect(opened).toHaveLength(0);
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
