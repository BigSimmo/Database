import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "../src/lib/validation/body";

const jsonBodyLimitBytes = 256 * 1024;

describe("bounded JSON request parsing", () => {
  it("rejects an oversized declared body before parsing", async () => {
    const request = new Request("https://clinical.test/api/search", {
      method: "POST",
      headers: { "content-length": String(jsonBodyLimitBytes + 1) },
      body: "{}",
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({
      status: 413,
      details: { code: "payload_too_large" },
    });
  });

  it("rejects an oversized chunked body while reading", async () => {
    const request = new Request("https://clinical.test/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(jsonBodyLimitBytes + 1).fill(32));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({
      status: 413,
      details: { code: "payload_too_large" },
    });
  });
});
