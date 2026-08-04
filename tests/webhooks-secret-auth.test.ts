import { describe, expect, it } from "vitest";
import { presentedWebhookSecret, timingSafeSecretEqual, verifyWebhookSecret } from "../src/lib/webhooks/secret-auth";

const SECRET = "a-sufficiently-long-secret-value";

function req(init: { headers?: Record<string, string>; url?: string } = {}) {
  return new Request(init.url ?? "http://localhost/api/webhooks/test", { headers: init.headers ?? {} });
}

describe("timingSafeSecretEqual", () => {
  it("returns true only for an exact match", () => {
    expect(timingSafeSecretEqual(SECRET, SECRET)).toBe(true);
    expect(timingSafeSecretEqual(SECRET, `${SECRET}x`)).toBe(false);
    expect(timingSafeSecretEqual("", SECRET)).toBe(false);
  });

  it("does not throw on multi-byte length mismatches", () => {
    // "é" is 2 UTF-8 bytes but 1 UTF-16 code unit; a naive .length gate would let
    // this reach timingSafeEqual with mismatched buffers and throw.
    expect(() => timingSafeSecretEqual("é", "ab")).not.toThrow();
    expect(timingSafeSecretEqual("é", "ab")).toBe(false);
  });
});

describe("presentedWebhookSecret", () => {
  it("prefers the custom header, then Bearer, then optional query token", () => {
    expect(presentedWebhookSecret(req({ headers: { "x-webhook-secret": "h" } }))).toBe("h");
    expect(presentedWebhookSecret(req({ headers: { authorization: "Bearer b" } }))).toBe("b");
    expect(
      presentedWebhookSecret(req({ url: "http://localhost/api/webhooks/test?token=q" }), { allowQueryToken: true }),
    ).toBe("q");
  });

  it("ignores the query token unless explicitly allowed", () => {
    expect(presentedWebhookSecret(req({ url: "http://localhost/api/webhooks/test?token=q" }))).toBe("");
  });
});

describe("verifyWebhookSecret", () => {
  it("fails closed as misconfigured when no secret is set", () => {
    expect(verifyWebhookSecret(req(), undefined)).toEqual({ ok: false, reason: "misconfigured" });
  });

  it("is unauthorized when nothing is presented or the value is wrong", () => {
    expect(verifyWebhookSecret(req(), SECRET)).toEqual({ ok: false, reason: "unauthorized" });
    expect(verifyWebhookSecret(req({ headers: { "x-webhook-secret": "nope" } }), SECRET)).toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("authorizes a correct header, Bearer, or allowed query token", () => {
    expect(verifyWebhookSecret(req({ headers: { "x-webhook-secret": SECRET } }), SECRET)).toEqual({ ok: true });
    expect(verifyWebhookSecret(req({ headers: { authorization: `Bearer ${SECRET}` } }), SECRET)).toEqual({ ok: true });
    expect(
      verifyWebhookSecret(req({ url: `http://localhost/api/webhooks/test?token=${SECRET}` }), SECRET, {
        allowQueryToken: true,
      }),
    ).toEqual({ ok: true });
  });
});
