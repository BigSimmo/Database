import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { CME_EVIDENCE_MAX_BYTES } from "@/lib/cme/evidence-model";
import { readCmeEvidenceForm, validateCmeEvidenceFile } from "@/lib/cme/evidence-upload";

vi.mock("server-only", () => ({}));
const url = "http://localhost.invalid/api/cme/entries/synthetic/evidence";
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
);
function file(bytes: Uint8Array, type = "application/pdf", name = "synthetic.pdf") {
  return new File([new Uint8Array(bytes)], name, { type });
}
function multipart(attachment: File) {
  const body = new FormData();
  body.set("file", attachment);
  body.set("kind", "certificate");
  body.set("redactionConfirmed", "true");
  body.set("previewConfirmed", "true");
  return new Request(url, { method: "POST", body });
}

describe("CME evidence bounded multipart reader (no network)", () => {
  it("parses an actual multipart body and preserves evidence confirmations and bytes", async () => {
    const form = await readCmeEvidenceForm(multipart(file(pdf)));
    expect(form.get("kind")).toBe("certificate");
    expect(form.get("redactionConfirmed")).toBe("true");
    expect(form.get("previewConfirmed")).toBe("true");
    const attachment = form.get("file") as File;
    expect(attachment.name).toBe("synthetic.pdf");
    expect(await validateCmeEvidenceFile(attachment)).toEqual(pdf);
  });
  it.each(["-1", "not-a-number", "Infinity", String(CME_EVIDENCE_MAX_BYTES + 65537)])(
    "rejects invalid or oversized declared length %s before reading",
    async (length) => {
      const request = multipart(file(pdf));
      request.headers.set("content-length", length);
      const read = vi.spyOn(request.body!, "getReader");
      await expect(readCmeEvidenceForm(request)).rejects.toMatchObject({ status: 413 });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "1"])("bounds the actual chunked stream even when Content-Length is %s", async (length) => {
    let chunks = 0;
    const cancel = vi.fn();
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks++;
        controller.enqueue(chunk);
      },
      cancel,
    });
    const request = new Request(url, {
      method: "POST",
      body,
      duplex: "half",
      headers: {
        "content-type": "multipart/form-data; boundary=synthetic",
        ...(length ? { "content-length": length } : {}),
      },
    } as RequestInit & { duplex: "half" });
    await expect(readCmeEvidenceForm(request)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThanOrEqual(12);
    expect(request.body!.locked).toBe(false);
  });
  it("rejects missing and malformed bodies with a safe client error", async () => {
    await expect(readCmeEvidenceForm(new Request(url, { method: "POST" }))).rejects.toMatchObject({ status: 400 });
    await expect(
      readCmeEvidenceForm(
        new Request(url, {
          method: "POST",
          body: "not a multipart body",
          headers: { "content-type": "multipart/form-data; boundary=missing" },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("rejects a real multipart file above 10 MB even when its envelope fits the bounded parser", async () => {
    const form = await readCmeEvidenceForm(multipart(file(new Uint8Array(CME_EVIDENCE_MAX_BYTES + 1))));
    await expect(validateCmeEvidenceFile(form.get("file") as File)).rejects.toMatchObject({ status: 413 });
  });
});

describe("CME evidence signature and file size admission", () => {
  it("admits PDF signature/trailer at exactly the file limit", async () => {
    const bytes = Buffer.alloc(CME_EVIDENCE_MAX_BYTES, 32);
    bytes.write("%PDF-1.4\n", 0, "ascii");
    bytes.write("%%EOF", bytes.length - 5, "ascii");
    const accepted = await validateCmeEvidenceFile(file(bytes));
    expect(accepted.length).toBe(CME_EVIDENCE_MAX_BYTES);
  });
  it.each([new Uint8Array(), new Uint8Array(CME_EVIDENCE_MAX_BYTES + 1)])(
    "rejects empty or oversized files",
    async (bytes) => {
      await expect(validateCmeEvidenceFile(file(bytes))).rejects.toMatchObject({ status: 413 });
    },
  );
  it.each(["text/html", "image/svg+xml", "application/zip"])(
    "rejects unsupported MIME %s despite a PDF name and signature",
    async (type) => {
      await expect(validateCmeEvidenceFile(file(pdf, type))).rejects.toMatchObject({ status: 400 });
    },
  );
  it.each([
    Buffer.from("MZ executable renamed as PDF %%EOF"),
    Buffer.from("%PDF-1.4\nincomplete"),
    Buffer.from("%PDF-1.4\n%%EOF\ntrailing active content"),
  ])("rejects a mislabeled or incomplete PDF", async (bytes) => {
    await expect(validateCmeEvidenceFile(file(bytes))).rejects.toMatchObject({ status: 400 });
  });
  it.each(["png", "jpeg"] as const)("admits actual %s image bytes through the image decoder", async (format) => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
      [format]()
      .toBuffer();
    expect(await validateCmeEvidenceFile(file(bytes, `image/${format}`, `synthetic.${format}`))).toEqual(bytes);
  });
  it("rejects valid image bytes labeled as the other image format", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    await expect(validateCmeEvidenceFile(file(bytes, "image/jpeg", "synthetic.jpg"))).rejects.toMatchObject({
      status: 400,
    });
  });
  it.each([
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0])],
    ["image/jpeg", Buffer.from([255, 216, 255, 0, 0, 0])],
  ] as const)("rejects a %s magic prefix with unreadable image metadata", async (type, bytes) => {
    await expect(validateCmeEvidenceFile(file(bytes, type))).rejects.toMatchObject({ status: 400 });
  });
});
