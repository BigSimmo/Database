import { readFileSync } from "node:fs";
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
import {
  stageFetchedPublicSource,
  type PublicSourceStagingDependencies,
} from "../scripts/fetch-approved-public-source-versions";

vi.mock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { SUPABASE_DOCUMENT_BUCKET: "offline-test", WORKER_MAX_ATTEMPTS: 3 } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("default admin client is forbidden in provider-free tests");
  },
}));

const stewardId = "22222222-2222-4222-8222-222222222222";
const activationEventId = "33333333-3333-4333-8333-333333333333";
const activationSequence = 17;
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
    activationSequence,
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
      activationSequence,
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
    "0:0:0:0:0:ffff:7f00:1",
    "0:0:0:0:0:ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::192.0.2.1",
    "100::1",
    "64:ff9b:1::1",
    "2001:2::1",
    "2001:db8::1",
    "2002:c000:0201::1",
    "3fff::1",
    "5f00::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
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

  it("bounds a never-resolving DNS resolver under total timeout and caller abort", async () => {
    const plan = await activePlan();
    const never = vi.fn(() => new Promise<never>(() => undefined));
    await expect(fetchApprovedPublicSource(plan, { resolve: never, totalTimeoutMs: 20 })).rejects.toThrow(
      /cancel|timeout|dns/i,
    );

    const controller = new AbortController();
    const pending = fetchApprovedPublicSource(plan, {
      resolve: never,
      signal: controller.signal,
      totalTimeoutMs: 5_000,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/cancel|abort|timeout|dns/i);
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

  it("uses parsed visible content for entity decoding and quarantine decisions", () => {
    const extracted = extractTrustedHtmlContent(`
      <html><body><main>
        <p hidden>Health&#x64;irect hidden marker</p>
        <p aria-hidden="true">Healthdirect hidden marker</p>
        <p>Republished from Health&#100;irect&nbsp;Australia &amp; partners.</p>
      </main></body></html>
    `);
    expect(extracted.disposition).toBe("quarantined");
    expect(extracted.text).toContain("Healthdirect Australia & partners.");
    expect(extracted.text).not.toContain("hidden marker");
    expect(() => extractTrustedHtmlContent("<main hidden><p>Health&#x64;irect</p></main>")).toThrow(/main|article/i);
  });

  it("inherits hidden state from ancestors before choosing retained main content", () => {
    const extracted = extractTrustedHtmlContent(`
      <html><body>
        <section hidden><main>Healthdirect hidden ancestor marker</main></section>
        <section aria-hidden="true"><article>Healthdirect aria-hidden ancestor marker</article></section>
        <div style="display: none"><main>Healthdirect inline-hidden ancestor marker</main></div>
        <main><p>Visible clinical guidance.</p></main>
      </body></html>
    `);
    expect(extracted).toMatchObject({ disposition: "shadow" });
    expect(extracted.text).toBe("Visible clinical guidance.");
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

  it("reserves authority before upload and recovers an ambiguous committed finalization", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "d".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "quarantined" as const,
    };
    const calls: string[] = [];
    const committed = {
      id: "44444444-4444-4444-8444-444444444444",
      lifecycle: "quarantined",
      staging_document_id: "55555555-5555-4555-8555-555555555555",
    };
    let reservedManifest: Record<string, string | number> = {};
    const dependencies: PublicSourceStagingDependencies = {
      reserve: vi.fn(async ({ manifest }) => {
        calls.push("reserve");
        reservedManifest = manifest as unknown as Record<string, string | number>;
        return {
          id: committed.id,
          reservedDocumentId: committed.staging_document_id,
          storagePath: `${stewardId}/public-source-staging/${committed.id}/source.txt`,
          stagingDocumentId: null,
          lifecycle: "discovered",
        };
      }),
      upload: vi.fn(async () => {
        calls.push("upload");
      }),
      finalize: vi.fn(async () => {
        calls.push("finalize");
        throw new Error("ambiguous transport failure after commit");
      }),
      lookup: vi.fn(async () => {
        calls.push("lookup");
        return {
          ...committed,
          reservation_key: reservedManifest.reservationKey as string,
          source_catalogue_key: plan.catalogueKey,
          source_policy_version: plan.sourcePolicyVersion,
          source_policy_digest: plan.sourcePolicyDigest,
          activation_event_id: plan.activationEventId,
          activation_sequence: plan.activationSequence,
          exact_canonical_url: australianSourceByKey(plan.catalogueKey)!.canonicalUrl,
          exact_version_url: plan.exactUrl,
          exact_version: plan.exactVersion,
          content_hash: fetched.contentHash,
          licence_evidence_digest: plan.licenceEvidenceDigest,
          steward_id: plan.stewardId,
          intended_disposition: fetched.disposition,
          reserved_document_id: committed.staging_document_id,
          reserved_storage_path: `${stewardId}/public-source-staging/${committed.id}/source.txt`,
        };
      }),
    };

    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).resolves.toMatchObject({
      disposition: "quarantined",
      version: committed,
    });
    expect(calls).toEqual(["reserve", "upload", "finalize", "lookup"]);
    expect(dependencies.upload).toHaveBeenCalledWith(expect.objectContaining({ upsert: true }));
  });

  it.each(["denied", "stale"])("checks %s current authority before DNS, HTTP, reservation, or upload", async () => {
    const plan = await activePlan();
    const execution = (await import("../scripts/fetch-approved-public-source-versions")) as unknown as {
      fetchAndStageApprovedPublicSource?: (
        plan: PublicSourceAcquisitionPlan,
        dependencies: Record<string, unknown>,
        acquisition: { resolve: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> },
      ) => Promise<unknown>;
    };
    expect(execution.fetchAndStageApprovedPublicSource).toBeTypeOf("function");
    const resolve = vi.fn();
    const request = vi.fn();
    const reserve = vi.fn();
    const upload = vi.fn();
    const preflight = vi.fn(async () => {
      throw new Error("Current public source authority denied the stale manifest.");
    });
    await expect(
      execution.fetchAndStageApprovedPublicSource!(
        plan,
        { preflight, reserve, upload, finalize: vi.fn(), lookup: vi.fn(), abandon: vi.fn(), remove: vi.fn() },
        { resolve, request },
      ),
    ).rejects.toThrow(/authority|stale|denied/i);
    expect(preflight).toHaveBeenCalledWith({
      manifest: expect.objectContaining({
        catalogueKey: plan.catalogueKey,
        activationEventId: plan.activationEventId,
        activationSequence,
        sourcePolicyVersion: plan.sourcePolicyVersion,
        sourcePolicyDigest: plan.sourcePolicyDigest,
        exactVersionUrl: plan.exactUrl,
      }),
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("uses the same injected preflight before change-detection fetch", async () => {
    const plan = await activePlan();
    const changes = (await import("../scripts/check-public-source-changes")) as unknown as {
      fetchPublicSourceChangeCandidate?: (
        plan: PublicSourceAcquisitionPlan,
        currentHash: string,
        dependencies: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    expect(changes.fetchPublicSourceChangeCandidate).toBeTypeOf("function");
    const resolve = vi.fn();
    const request = vi.fn();
    const upload = vi.fn();
    await expect(
      changes.fetchPublicSourceChangeCandidate!(plan, "a".repeat(64), {
        preflight: vi.fn(async () => {
          throw new Error("Stale activation sequence.");
        }),
        resolve,
        request,
        upload,
      }),
    ).rejects.toThrow(/stale|authority/i);
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("recovers ambiguous finalization from legal committed descendant lifecycles", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "c".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "shadow" as const,
    };
    let reservedManifest: Record<string, string | number> = {};
    const reservation = {
      id: "44444444-4444-4444-8444-444444444444",
      reservedDocumentId: "55555555-5555-4555-8555-555555555555",
      storagePath: `${stewardId}/public-source-staging/descendant/source.txt`,
      stagingDocumentId: null,
      lifecycle: "discovered",
    };
    const lookup = vi.fn(async () => ({
      id: reservation.id,
      lifecycle: "active",
      staging_document_id: reservation.reservedDocumentId,
      reservation_key: reservedManifest.reservationKey,
      source_catalogue_key: plan.catalogueKey,
      source_policy_version: plan.sourcePolicyVersion,
      source_policy_digest: plan.sourcePolicyDigest,
      activation_event_id: plan.activationEventId,
      activation_sequence: plan.activationSequence,
      exact_canonical_url: australianSourceByKey(plan.catalogueKey)!.canonicalUrl,
      exact_version_url: plan.exactUrl,
      exact_version: plan.exactVersion,
      content_hash: fetched.contentHash,
      licence_evidence_digest: plan.licenceEvidenceDigest,
      steward_id: plan.stewardId,
      intended_disposition: fetched.disposition,
      reserved_document_id: reservation.reservedDocumentId,
      reserved_storage_path: reservation.storagePath,
    }));
    const dependencies = {
      reserve: vi.fn(async ({ manifest }: { manifest: Record<string, string | number> }) => {
        reservedManifest = manifest;
        return reservation;
      }),
      upload: vi.fn(async () => undefined),
      finalize: vi.fn(async () => {
        throw new Error("ambiguous after commit");
      }),
      lookup,
      abandon: vi.fn(),
      remove: vi.fn(),
    } as unknown as PublicSourceStagingDependencies;
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).resolves.toMatchObject({
      version: { lifecycle: "active", staging_document_id: reservation.reservedDocumentId },
    });
    expect(lookup).toHaveBeenCalledOnce();
    expect((dependencies as unknown as { abandon: ReturnType<typeof vi.fn> }).abandon).not.toHaveBeenCalled();
    expect((dependencies as unknown as { remove: ReturnType<typeof vi.fn> }).remove).not.toHaveBeenCalled();
  });

  it("abandons only a definitively unowned reservation before deleting its blob", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "b".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "shadow" as const,
    };
    const calls: string[] = [];
    let reservedManifest: Record<string, string | number> = {};
    const reservation = {
      id: "44444444-4444-4444-8444-444444444444",
      reservedDocumentId: "55555555-5555-4555-8555-555555555555",
      storagePath: `${stewardId}/public-source-staging/abandon/source.txt`,
      stagingDocumentId: null,
      lifecycle: "discovered",
    };
    const recoveryState = () => ({
      id: reservation.id,
      lifecycle: "discovered",
      staging_document_id: null,
      reservation_key: reservedManifest.reservationKey,
      source_catalogue_key: plan.catalogueKey,
      source_policy_version: plan.sourcePolicyVersion,
      source_policy_digest: plan.sourcePolicyDigest,
      activation_event_id: plan.activationEventId,
      activation_sequence: plan.activationSequence,
      exact_canonical_url: australianSourceByKey(plan.catalogueKey)!.canonicalUrl,
      exact_version_url: plan.exactUrl,
      exact_version: plan.exactVersion,
      content_hash: fetched.contentHash,
      licence_evidence_digest: plan.licenceEvidenceDigest,
      steward_id: plan.stewardId,
      intended_disposition: fetched.disposition,
      reserved_document_id: reservation.reservedDocumentId,
      reserved_storage_path: reservation.storagePath,
    });
    const dependencies = {
      reserve: vi.fn(async ({ manifest }: { manifest: Record<string, string | number> }) => {
        calls.push("reserve");
        reservedManifest = manifest;
        return reservation;
      }),
      upload: vi.fn(async () => calls.push("upload")),
      finalize: vi.fn(async () => {
        calls.push("finalize");
        throw new Error("authority revoked before finalize");
      }),
      lookup: vi.fn(async () => {
        calls.push("lookup");
        return recoveryState();
      }),
      abandon: vi.fn(async () => {
        calls.push("abandon");
        return { status: "abandoned", storagePath: reservation.storagePath, storageOwned: false };
      }),
      remove: vi.fn(async () => calls.push("remove")),
    } as unknown as PublicSourceStagingDependencies;
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).rejects.toThrow(/abandon|fresh authority/i);
    expect(calls).toEqual(["reserve", "upload", "finalize", "lookup", "abandon", "remove"]);
  });

  it("rechecks an ambiguous abandonment and cleans only after its durable unowned result", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "6".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "shadow" as const,
    };
    let manifest: Record<string, string | number> = {};
    let lookupCount = 0;
    const reservation = {
      id: "44444444-4444-4444-8444-444444444444",
      reservedDocumentId: "55555555-5555-4555-8555-555555555555",
      storagePath: `${stewardId}/public-source-staging/ambiguous-abandon/source.txt`,
      stagingDocumentId: null,
      lifecycle: "discovered",
    };
    const state = (lifecycle: string) => ({
      id: reservation.id,
      lifecycle,
      staging_document_id: null,
      reservation_key: manifest.reservationKey as string,
      source_catalogue_key: plan.catalogueKey,
      source_policy_version: plan.sourcePolicyVersion,
      source_policy_digest: plan.sourcePolicyDigest,
      activation_event_id: plan.activationEventId,
      activation_sequence: plan.activationSequence,
      exact_canonical_url: australianSourceByKey(plan.catalogueKey)!.canonicalUrl,
      exact_version_url: plan.exactUrl,
      exact_version: plan.exactVersion,
      content_hash: fetched.contentHash,
      licence_evidence_digest: plan.licenceEvidenceDigest,
      steward_id: plan.stewardId,
      intended_disposition: fetched.disposition,
      reserved_document_id: reservation.reservedDocumentId,
      reserved_storage_path: reservation.storagePath,
    });
    const abandon = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce({ status: "abandoned", storagePath: reservation.storagePath, storageOwned: false });
    const remove = vi.fn(async () => undefined);
    const dependencies = {
      reserve: vi.fn(async ({ manifest: reserved }: { manifest: Record<string, string | number> }) => {
        manifest = reserved;
        return reservation;
      }),
      upload: vi.fn(async () => undefined),
      finalize: vi.fn(async () => {
        throw new Error("authority revoked");
      }),
      lookup: vi.fn(async () => state(lookupCount++ === 0 ? "discovered" : "abandoned")),
      abandon,
      remove,
    } as unknown as PublicSourceStagingDependencies;
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).rejects.toThrow(/abandon|fresh authority/i);
    expect(abandon).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(reservation.storagePath);
  });

  it("rejects mismatched recovery identity and never cleans up after an ambiguous lookup", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "9".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "shadow" as const,
    };
    const abandon = vi.fn();
    const remove = vi.fn();
    const dependencies = {
      reserve: vi.fn(async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        reservedDocumentId: "55555555-5555-4555-8555-555555555555",
        storagePath: `${stewardId}/public-source-staging/mismatch/source.txt`,
        stagingDocumentId: null,
        lifecycle: "discovered",
      })),
      upload: vi.fn(async () => undefined),
      finalize: vi.fn(async () => {
        throw new Error("ambiguous finalize");
      }),
      lookup: vi.fn(async () => {
        throw new Error("ambiguous recovery lookup");
      }),
      abandon,
      remove,
    } as unknown as PublicSourceStagingDependencies;
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).rejects.toThrow(/recovery|lookup|ambiguous/i);
    expect(abandon).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not accept a bound recovery row whose immutable hash or reservation identity changed", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "8".repeat(64),
      byteCount: 12,
      mime: "text/plain" as const,
      content: Buffer.from("clinical text"),
      text: "clinical text",
      disposition: "shadow" as const,
    };
    const documentId = "55555555-5555-4555-8555-555555555555";
    const dependencies: PublicSourceStagingDependencies = {
      reserve: vi.fn(async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        reservedDocumentId: documentId,
        storagePath: `${stewardId}/public-source-staging/mismatch/source.txt`,
        stagingDocumentId: null,
        lifecycle: "discovered",
      })),
      upload: vi.fn(async () => undefined),
      finalize: vi.fn(async () => {
        throw new Error("ambiguous finalize");
      }),
      lookup: vi.fn(async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        lifecycle: "shadow",
        staging_document_id: documentId,
        reservation_key: "wrong-reservation-key",
        content_hash: "7".repeat(64),
      })),
    };
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).rejects.toThrow(/identity|recovery|committed/i);
  });

  it("does not upload a finalized retry or expose a destructive cleanup dependency", async () => {
    const plan = await activePlan();
    const fetched = {
      finalUrl: plan.exactUrl,
      contentHash: "e".repeat(64),
      byteCount: 12,
      mime: "text/plain",
      content: Buffer.from("clinical text"),
      disposition: "shadow" as const,
    };
    const upload = vi.fn();
    const finalize = vi.fn();
    const lookup = vi.fn();
    const dependencies: PublicSourceStagingDependencies = {
      reserve: vi.fn(async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        reservedDocumentId: "55555555-5555-4555-8555-555555555555",
        storagePath: `${stewardId}/public-source-staging/final/source.txt`,
        stagingDocumentId: "55555555-5555-4555-8555-555555555555",
        lifecycle: "shadow",
      })),
      upload,
      finalize,
      lookup,
    };
    await expect(stageFetchedPublicSource(plan, fetched, dependencies)).resolves.toMatchObject({
      disposition: "duplicate",
    });
    expect(upload).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    expect(dependencies).not.toHaveProperty("remove");
  });

  it("keeps plan and change CLI imports behind direct-entry guards", () => {
    for (const file of ["scripts/plan-public-source-acquisition.ts", "scripts/check-public-source-changes.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain('import { pathToFileURL } from "node:url"');
      expect(source).toContain("import.meta.url === pathToFileURL(process.argv[1]).href");
    }
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
