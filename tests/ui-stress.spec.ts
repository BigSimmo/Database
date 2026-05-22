import { expect, test, type Page } from "playwright/test";

const longTitle =
  "Extremely long synthetic shared-care guideline title covering lithium clozapine perinatal risk ADHD medication review emergency escalation and outpatient monitoring pathways";

function makeDocument(index: number) {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `${longTitle} ${index}`,
    description: null,
    file_name: `very-long-uploaded-guideline-file-name-for-responsive-layout-stress-case-${index}.pdf`,
    file_type: "application/pdf",
    file_size: 100_000 + index,
    storage_path: `/stress/document-${index}.pdf`,
    status: "indexed",
    page_count: 24 + index,
    chunk_count: 12 + index,
    image_count: index % 3,
    error_message: null,
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:00:00.000Z",
  };
}

function makeSource(index: number) {
  const document = makeDocument((index % 18) + 1);
  return {
    id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    document_id: document.id,
    title: document.title,
    file_name: document.file_name,
    page_number: (index % 9) + 1,
    chunk_index: index,
    section_heading: `Long section heading ${index}`,
    content:
      "This deliberately long stress-test passage checks wrapping, source-card density, citation chips, action rows, and document titles without relying on production data changes.",
    image_ids: [],
    similarity: 0.91 - index / 100,
    source_strength: "strong",
    images: [],
  };
}

function citationFromSource(source: ReturnType<typeof makeSource>) {
  return {
    chunk_id: source.id,
    document_id: source.document_id,
    title: source.title,
    file_name: source.file_name,
    page_number: source.page_number,
    chunk_index: source.chunk_index,
    similarity: source.similarity,
  };
}

function makeStressAnswer() {
  const sources = Array.from({ length: 20 }, (_, index) => makeSource(index + 1));
  const citations = sources.slice(0, 14).map(citationFromSource);
  const quoteCards = sources.slice(0, 10).map((source) => ({
    ...citationFromSource(source),
    quote:
      "This exact quote is intentionally long enough to test wrapping in quote cards and action rows without causing layout overflow.",
    section_heading: source.section_heading,
    source_strength: "strong",
  }));

  return {
    answer:
      "Stress answer with many citations and long source names. The UI should wrap dense evidence cleanly, keep action rows reachable, and avoid page-level horizontal scrolling.",
    grounded: true,
    confidence: "high",
    citations,
    sources,
    quoteCards,
    answerSections: Array.from({ length: 6 }, (_, index) => ({
      heading: `Stress detail section ${index + 1}`,
      body: "Long detail copy validates that answer detail cards wrap without compressing adjacent content or creating horizontal overflow.",
      citation_chunk_ids: sources.slice(index, index + 3).map((source) => source.id),
    })),
    evidenceSummary: {
      document_count: 18,
      total_sources: sources.length,
      quote_count: quoteCards.length,
      image_count: 0,
      source_strength: "strong",
      summary: "Stress response spanning many documents and citations.",
    },
    sourceCoverage: {
      documents_used: 18,
      pages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      strongest_similarity: 0.91,
      has_images: false,
    },
    conflictsOrGaps: [],
    visualEvidence: [],
    bestSource: {
      ...citationFromSource(sources[0]),
      source_strength: "strong",
      score: 0.91,
      snippet: "Stress best source snippet.",
      quote: "Stress best source exact quote.",
      section_heading: sources[0].section_heading,
      image_count: 0,
      viewer_href: `/documents/${sources[0].document_id}?page=1&chunk=${sources[0].id}`,
    },
    documentBreakdown: Array.from({ length: 18 }, (_, index) => {
      const document = makeDocument(index + 1);
      return {
        document_id: document.id,
        title: document.title,
        file_name: document.file_name,
        top_similarity: 0.9 - index / 100,
        source_strength: "strong",
        source_count: 2,
        quote_count: 1,
        pages: [1, 2, 3],
      };
    }),
  };
}

async function mockStressData(page: Page) {
  const documents = Array.from({ length: 24 }, (_, index) => makeDocument(index + 1));

  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { documents, demoMode: true } });
  });
  await page.route(/\/api\/jobs(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { jobs: [], demoMode: true } });
  });
  await page.route(/\/api\/setup-status(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        demoMode: true,
        checks: [
          { id: "env", label: ".env.local configured", status: "needs_setup", detail: "Mocked missing env." },
          { id: "schema", label: "supabase/schema.sql applied", status: "unknown", detail: "Mocked schema unknown." },
          { id: "openai", label: "OpenAI API key available", status: "needs_setup", detail: "Mocked missing key." },
          { id: "worker", label: "npm run worker running", status: "unknown", detail: "Mocked worker unknown." },
        ],
      },
    });
  });
  await page.route(/\/api\/answer(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: makeStressAnswer() });
  });
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Clinical KB long-content stress coverage", () => {
  for (const viewport of [
    { name: "mobile", width: 320, height: 740 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    test(`many documents and citations do not overflow at ${viewport.name}`, async ({ page }) => {
      await mockStressData(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(
        page.getByText(viewport.name === "mobile" ? "24 documents" : "24 indexed documents available"),
      ).toBeVisible();
      await expectNoPageHorizontalOverflow(page);

      await page
        .getByLabel("Ask a question across indexed guidelines")
        .fill("Show all stress citations and source cards");
      await page.getByRole("button", { name: /Ask|Answer/ }).click();

      await expect(page.getByLabel("Source-backed answer")).toBeVisible();
      await expect(page.getByText("10 exact quotes")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
