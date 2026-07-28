import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defaultJsonBodyLimitBytes, parseJsonBody, webhookJsonBodyLimitBytes } from "../src/lib/validation/body";

describe("bounded JSON request parsing", () => {
  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://clinical.test/api/search", {
      method: "POST",
      headers: { "content-length": String(defaultJsonBodyLimitBytes + 1) },
      body: "{}",
    });
    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({
      status: 413,
      details: { code: "payload_too_large" },
    });
  });

  it("rejects an oversized chunked body while reading", async () => {
    const chunk = new Uint8Array(defaultJsonBodyLimitBytes + 1).fill(32);
    const request = new Request("https://clinical.test/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
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

  it("supports a stricter webhook-specific byte ceiling", async () => {
    const request = new Request("https://clinical.test/api/webhooks/test", {
      method: "POST",
      headers: { "content-length": String(webhookJsonBodyLimitBytes + 1) },
      body: "{}",
    });

    await expect(
      parseJsonBody(request, z.object({}), "Invalid webhook body.", webhookJsonBodyLimitBytes),
    ).rejects.toMatchObject({
      status: 413,
      details: { code: "payload_too_large" },
    });
  });
});
