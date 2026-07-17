import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAnswer, demoDocuments, demoSearch, getDemoDocumentPayload } from "../src/lib/demo-data";

describe("demo data mode", () => {
  it("seeds three indexed documents", () => {
    expect(demoDocuments).toHaveLength(3);
    expect(demoDocuments.every((document) => document.status === "indexed")).toBe(true);
  });

  it("matches lithium toxicity safety-net queries", () => {
    const results = demoSearch("What toxicity safety-net symptoms should be reviewed for lithium?");
    expect(results[0].title).toContain("lithium");
    expect(results[0].content).toContain("vomiting");
  });

  it("matches clozapine image table queries", () => {
    const results = demoSearch("What clozapine monitoring items are shown in the table image?");
    expect(results[0].title).toContain("clozapine");
    expect(results.some((result) => result.images.length > 0)).toBe(true);
  });

  it("returns quote cards for the seeded image and medication questions", () => {
    const clozapine = demoAnswer("What clozapine monitoring items are shown in the table image?");
    const lithium = demoAnswer("What toxicity safety-net symptoms should be reviewed for lithium?");

    expect(clozapine.quoteCards?.some((quote) => quote.quote.includes("FBC/ANC"))).toBe(true);
    expect(lithium.quoteCards?.some((quote) => quote.quote.includes("vomiting"))).toBe(true);
    expect(clozapine.smartPanel?.image_count).toBeGreaterThan(0);
    expect(clozapine.visualEvidence?.some((image) => image.caption.includes("FBC/ANC"))).toBe(true);
  });

  it("filters demo search and answers to selected documents", () => {
    const clozapineId = demoDocuments[1].id;
    const answer = demoAnswer("What monitoring items should I review?", undefined, [clozapineId]);

    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.sources.every((source) => source.document_id === clozapineId)).toBe(true);
    expect(answer.documentBreakdown).toHaveLength(1);
  });

  it("matches acute risk escalation queries", () => {
    const answer = demoAnswer("When should acute risk be escalated for senior review?");
    expect(answer.grounded).toBe(true);
    expect(answer.answer).toContain("current intent");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.quoteCards?.length).toBeGreaterThan(0);
  });

  it("synthesizes broad questions across multiple demo documents", () => {
    const answer = demoAnswer("What monitoring and escalation issues should I consider across these documents?");

    expect(answer.grounded).toBe(true);
    expect(answer.answer).toContain("Lithium");
    expect(answer.answer).toContain("Clozapine");
    expect(answer.answer).toContain("acute risk");
    expect(answer.documentBreakdown?.length).toBeGreaterThan(1);
    expect(answer.evidenceSummary?.document_count).toBeGreaterThan(1);
    expect(answer.visualEvidence?.length).toBeGreaterThan(1);
  });

  it("marks unsupported demo questions as ungrounded while keeping near-miss sources", () => {
    const answer = demoAnswer("What does the document say about insulin dosing in gestational diabetes?");

    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.bestSource).toBeTruthy();
  });

  it("does not give a confident acute-risk answer when 'risk' is only mentioned incidentally", () => {
    const answer = demoAnswer("Is there a bleeding risk with aspirin in elderly patients?");

    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.answer).not.toContain("acute risk document");
  });

  it("returns document viewer payload with chunks and image captions", () => {
    const clozapine = demoDocuments.find((document) => document.title.includes("clozapine"));
    expect(clozapine).toBeTruthy();
    const payload = getDemoDocumentPayload(clozapine!.id);
    expect(payload?.pages.length).toBeGreaterThan(0);
    expect(payload?.chunks.length).toBeGreaterThan(0);
    expect(payload?.images[0].caption).toContain("monitoring table");
  });

  it("joins labels, stored summary, and index health onto the viewer payload like the live API", () => {
    const lithium = getDemoDocumentPayload(demoDocuments[0].id);
    expect(lithium?.document.labels?.length).toBeGreaterThan(0);
    expect(lithium?.document.labels?.some((label) => label.label_type === "medication")).toBe(true);
    // Deliberately messy stored summary so the display-time formatter is exercised end-to-end.
    expect(lithium?.document.summary?.summary).toContain("Reference #");
    expect(lithium?.document.summary?.summary).toContain("narrow therapeutic index");
    expect(lithium?.indexHealth).toMatchObject({
      extractionQuality: "good",
      indexVersion: "rag-deep-memory-v1",
    });

    const clozapine = getDemoDocumentPayload(demoDocuments[1].id);
    expect(clozapine?.document.summary?.clinical_specifics?.profile?.overview).toContain("clozapine");
  });
});

// Class-level guard so a future route cannot reintroduce the /api/search/universal leak: demo
// fixtures must fail closed in a live production request and only run under an explicit demo deploy.
describe("demoSearch production safety guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to serve synthetic demo data to a live production request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    const { demoSearch: guarded } = await import("../src/lib/demo-data");
    expect(() => guarded("lithium toxicity")).toThrow(/synthetic demo data/i);
  });

  it("still serves fixtures for an explicit NEXT_PUBLIC_DEMO_MODE=true deploy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { demoSearch: guarded } = await import("../src/lib/demo-data");
    expect(() => guarded("lithium toxicity")).not.toThrow();
  });
});
