import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import { australianSourceByKey } from "@/lib/australian-source-catalogue";
import {
  createPublicSourceActivationManifest,
  publicSourcePolicyDigest,
} from "@/lib/public-source-activation-manifest";
import {
  acquisitionPlanDigest,
  classifyPublicSourceChange,
  extractTrustedHtmlContent,
  fetchApprovedPublicSource,
  isGlobalPublicAddress,
  normalizeAcquisitionMime,
  parseFetchApprovedSourceArgs,
  planAcquisition,
  PublicSourceAcquisitionError,
  validateAcquisitionUrl,
  validateRedirect,
  validateFetchedPublicSource,
  type AcquisitionRequest,
  type PublicSourceAcquisitionPlan,
} from "@/lib/public-source-acquisition";

const stewardId = "22222222-2222-4222-8222-222222222222";
const activationEventId = "33333333-3333-4333-8333-333333333333";
const licenceEvidenceDigest = "a".repeat(64);

function activation(catalogueKey = "wa-health") {
  return createPublicSourceActivationManifest({
    version: 1,
    sourcePolicyVersion: "australian-source-policy-v1",
    sourcePolicyDigest: publicSourcePolicyDigest,
    catalogueKey,
    decision: "activate",
    operatorId: "11111111-1111-4111-8111-111111111111",
    reason: "Controlled acquisition approved after legal review.",
    evidenceReferences: ["legal-review:2026-08"],
  });
}

function planInput(overrides: Record<string, unknown> = {}) {
  return {
    catalogueKey: "wa-health",
    exactUrl: "https://www.health.wa.gov.au/versioned/policy.pdf",
    exactVersion: "2026-08-24",
    exactDocumentLicence: "public_index_permitted" as const,
    licenceEvidenceDigest,
    stewardId,
    activationEventId,
    activationManifest: activation(),
    ...overrides,
  };
}

async function activePlan(overrides: Record<string, unknown> = {}) {
  return planAcquisition(planInput(overrides));
}

function chunks(...values: Array<string | Uint8Array>): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) yield typeof value === "string" ? Buffer.from(value) : value;
    },
  };
}

describe("public source acquisition", () => {
  it("rejects excluded and link-only sources before DNS or network access", async () => {
    const resolve = vi.fn();
    const request = vi.fn();

    await expect(
      planAcquisition(
        planInput({
          catalogueKey: "etg-complete",
          exactUrl: "https://www.tg.org.au/guide.pdf",
          activationManifest: { ...activation(), catalogueKey: "etg-complete" },
          resolve,
          request,
        }),
      ),
    ).rejects.toThrow(/link-only/i);
    await expect(
      planAcquisition(
        planInput({
          catalogueKey: "healthdirect",
          exactUrl: "https://www.healthdirect.gov.au/guide.pdf",
          activationManifest: { ...activation(), catalogueKey: "healthdirect" },
          resolve,
          request,
        }),
      ),
    ).rejects.toThrow(/not in the active catalogue/i);
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("requires matching source activation, exact-document licence, and a non-null steward", async () => {
    await expect(activePlan({ activationManifest: { ...activation(), decision: "quarantine" } })).rejects.toThrow(
      /active source definition/i,
    );
    await expect(activePlan({ exactDocumentLicence: "review_required" })).rejects.toThrow(/document licence/i);
    await expect(activePlan({ stewardId: null })).rejects.toThrow(/steward/i);
    await expect(activePlan({ activationEventId: null })).rejects.toThrow(/activation event/i);
  });

  it("emits an immutable, deterministic exact-version acquisition plan without network access", async () => {
    const resolve = vi.fn();
    const request = vi.fn();
    const plan = await activePlan({ resolve, request });

    expect(plan).toMatchObject({
      version: 1,
      sourcePolicyDigest: publicSourcePolicyDigest,
      catalogueKey: "wa-health",
      exactVersion: "2026-08-24",
      lifecycle: "discovered",
      stewardId,
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(acquisitionPlanDigest(plan)).toMatch(/^[0-9a-f]{64}$/);
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    "http://www.health.wa.gov.au/policy.pdf",
    "https://user:pass@www.health.wa.gov.au/policy.pdf",
    "https://www.health.wa.gov.au:444/policy.pdf",
    "https://www.health.wa.gov.au/policy.pdf#fragment",
    "https://127.0.0.1/policy.pdf",
    "https://evil.example/policy.pdf",
  ])("rejects unsafe exact URLs before DNS: %s", async (url) => {
    const resolve = vi.fn();
    await expect(validateAcquisitionUrl(url, australianSourceByKey("wa-health")!, { resolve })).rejects.toThrow(
      /https|credentials|port|fragment|literal|allowlisted/i,
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.2",
    "203.0.113.2",
    "224.0.0.1",
    "240.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "100::1",
    "2001:db8::1",
    "fc00::1",
    "fe80::1",
    "ff00::1",
  ])("rejects non-global IPv4 and IPv6 address %s", (address) => {
    expect(isGlobalPublicAddress(address)).toBe(false);
  });

  it("rejects the whole DNS answer when any address is non-global", async () => {
    await expect(
      validateAcquisitionUrl("https://www.health.wa.gov.au/file.pdf", australianSourceByKey("wa-health")!, {
        resolve: async () => [
          { address: "1.1.1.1", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ],
      }),
    ).rejects.toThrow(/non-global|private/i);
  });

  it("pins the validated address into each request and re-resolves every manual redirect", async () => {
    const plan = await activePlan();
    const resolve = vi
      .fn()
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "2606:4700:4700::1111", family: 6 }]);
    const request = vi
      .fn<AcquisitionRequest>()
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: "/final.pdf" },
        body: chunks(),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { "content-type": "application/pdf" },
        body: chunks("%PDF-1.4\n%%EOF"),
      });

    const fetched = await fetchApprovedPublicSource(plan, { resolve, request });

    expect(fetched.contentHash).toBe("4f1949e95440af0ece666ebd5f399c1d77d22de639950784d349fa5feb47dca5");
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toMatchObject({ hostname: "www.health.wa.gov.au", address: "1.1.1.1" });
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      hostname: "www.health.wa.gov.au",
      address: "2606:4700:4700::1111",
    });
  });

  it("rejects off-host redirects, redirect loops, and more than three redirects", async () => {
    const definition = australianSourceByKey("wa-health")!;
    await expect(validateRedirect("https://evil.example/file.pdf", definition, { resolve: vi.fn() })).rejects.toThrow(
      /allowlisted/i,
    );

    const plan = await activePlan();
    const resolve = async () => [{ address: "1.1.1.1", family: 4 as const }];
    await expect(
      fetchApprovedPublicSource(plan, {
        resolve,
        request: async () => ({ status: 302, headers: { location: "/again" }, body: chunks() }),
      }),
    ).rejects.toThrow(/redirect loop/i);

    let redirect = 0;
    await expect(
      fetchApprovedPublicSource(plan, {
        resolve,
        request: async () => ({
          status: 302,
          headers: { location: `/redirect-${redirect++}` },
          body: chunks(),
        }),
      }),
    ).rejects.toThrow(/three redirects/i);
  });

  it("redacts rejected redirect locations and content-validation details", async () => {
    const plan = await activePlan();
    const resolve = async () => [{ address: "1.1.1.1", family: 4 as const }];
    const redirectError = await fetchApprovedPublicSource(plan, {
      resolve,
      request: async () => ({
        status: 302,
        headers: { location: "https://[invalid-query-secret" },
        body: chunks(),
      }),
    }).catch((caught: unknown) => caught);
    expect(redirectError).toBeInstanceOf(PublicSourceAcquisitionError);
    expect(JSON.stringify(redirectError)).not.toContain("invalid-query-secret");

    const validationError = await fetchApprovedPublicSource(plan, {
      resolve,
      request: async () => ({
        status: 200,
        headers: { "content-type": "application/pdf" },
        body: chunks("content-validation-secret"),
      }),
    }).catch((caught: unknown) => caught);
    expect(validationError).toBeInstanceOf(PublicSourceAcquisitionError);
    expect(JSON.stringify(validationError)).not.toContain("content-validation-secret");
  });

  it("enforces the streamed limit after decompression and cancels partial content", async () => {
    const plan = await activePlan();
    const cancel = vi.fn();
    const compressed = gzipSync(Buffer.from("x".repeat(2_048)));

    await expect(
      fetchApprovedPublicSource(plan, {
        maxBytes: 1_024,
        resolve: async () => [{ address: "1.1.1.1", family: 4 }],
        request: async () => ({
          status: 200,
          headers: { "content-type": "text/plain", "content-encoding": "gzip" },
          body: chunks(compressed),
          cancel,
        }),
      }),
    ).rejects.toThrow(/size|bytes|limit/i);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("honours caller cancellation before network access", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();

    await expect(
      fetchApprovedPublicSource(await activePlan(), {
        signal: controller.signal,
        resolve: async () => [{ address: "1.1.1.1", family: 4 }],
        request,
      }),
    ).rejects.toThrow(/cancel|abort/i);
    expect(request).not.toHaveBeenCalled();
  });

  it("normalizes MIME parameters and reuses file signature and structure validation", async () => {
    expect(normalizeAcquisitionMime("Application/PDF; charset=binary")).toBe("application/pdf");
    await expect(
      validateFetchedPublicSource({ mime: "application/pdf; charset=binary", content: Buffer.from("not a PDF") }),
    ).rejects.toThrow(/declared type|structure/i);
    await expect(
      validateFetchedPublicSource({ mime: "application/pdf", content: Buffer.from("%PDF-1.4\n%%EOF") }),
    ).resolves.toMatchObject({ mime: "application/pdf", disposition: "shadow" });
  });

  it("drops navigation, footer, active resources, and link targets from trusted HTML", () => {
    const html = `<!doctype html><html><body>
      <nav>Healthdirect <a href="https://www.healthdirect.gov.au/private?q=secret">external</a></nav>
      <main><h1>WA policy</h1><p>Retained clinical guidance.</p><img src="https://tracker.example/pixel"></main>
      <footer>Healthdirect footer</footer><script>window.secret = 'body-secret'</script>
    </body></html>`;

    const extracted = extractTrustedHtmlContent(html);

    expect(extracted.disposition).toBe("shadow");
    expect(extracted.text).toContain("WA policy");
    expect(extracted.text).toContain("Retained clinical guidance.");
    expect(extracted.text).not.toMatch(/healthdirect|tracker|private\?q|body-secret/i);
  });

  it("quarantines HTML when the Healthdirect marker remains in retained main content", () => {
    const extracted = extractTrustedHtmlContent(
      "<html><body><main><h1>Clinical page</h1><p>Republished from Healthdirect Australia.</p></main></body></html>",
    );
    expect(extracted).toMatchObject({ disposition: "quarantined" });
  });

  it("never includes response bodies, query strings, signed URLs, or operator identities in errors", async () => {
    const request = async () => ({
      status: 503,
      headers: { "content-type": "text/plain", "x-secret": "header-secret" },
      body: chunks("response-body-secret"),
    });
    const plan = await activePlan({
      exactUrl: "https://www.health.wa.gov.au/file.pdf?signature=query-secret",
    });

    const error = await fetchApprovedPublicSource(plan, {
      resolve: async () => [{ address: "1.1.1.1", family: 4 }],
      request,
    }).catch((caught: unknown) => caught);
    const rendered = JSON.stringify(error);
    expect(rendered).toContain("wa-health");
    expect(rendered).toContain("www.health.wa.gov.au");
    expect(rendered).not.toMatch(/response-body-secret|header-secret|query-secret|11111111/i);
  });

  it("classifies duplicate, changed, and withdrawal outcomes without automatic activation or supersession", async () => {
    const plan = await activePlan();
    expect(classifyPublicSourceChange({ plan, currentHash: "b".repeat(64), fetchedHash: "b".repeat(64) })).toEqual({
      disposition: "unchanged",
      createVersion: false,
    });
    expect(classifyPublicSourceChange({ plan, currentHash: "b".repeat(64), fetchedHash: "c".repeat(64) })).toEqual({
      disposition: "shadow",
      createVersion: true,
      supersedeCurrent: false,
    });
    expect(classifyPublicSourceChange({ plan, currentHash: "b".repeat(64), withdrawal: true })).toEqual({
      disposition: "tombstoned",
      createVersion: false,
      removeFromRetrieval: true,
      queueHumanReview: true,
    });
  });

  it("requires every explicit fetch confirmation while keeping dry-run arguments network-free", async () => {
    const plan = (await activePlan()) as PublicSourceAcquisitionPlan;
    const digest = acquisitionPlanDigest(plan);
    expect(parseFetchApprovedSourceArgs(["--manifest", "plan.json"])).toEqual({
      manifestPath: "plan.json",
      apply: false,
    });
    expect(() => parseFetchApprovedSourceArgs(["--manifest", "plan.json", "--apply"])).toThrow(/expected-count/i);
    expect(() =>
      parseFetchApprovedSourceArgs([
        "--manifest",
        "plan.json",
        "--expected-count",
        "1",
        "--confirm-sha256",
        digest,
        "--apply",
      ]),
    ).not.toThrow();
  });
});
