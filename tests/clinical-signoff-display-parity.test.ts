import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { evidenceText, guideBlocksText } from "../scripts/review-clinical-record.mjs";

import { EvidenceList } from "@/components/formulation/formulation-ui";
import { formulationConcepts, formulationGuides } from "@/lib/formulation-concepts";
import { formulationMechanisms } from "@/lib/formulation";

/**
 * The sign-off screen and review pack hand-replicate how a Formulation page renders its
 * evidence and guide text (the tool is plain Node and cannot render the app's components).
 * A clinician signs what the screen shows, so any divergence from the page must go red here
 * rather than let a sign-off vouch for text that reads differently on the site.
 */

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

type Evidence = Parameters<typeof EvidenceList>[0]["evidence"];

const records: Array<{ id: string; evidence: Evidence }> = [
  ...formulationConcepts,
  ...formulationGuides,
  ...formulationMechanisms,
].map((record) => ({ id: record.id, evidence: record.evidence as Evidence }));

describe("Formulation sign-off screen matches the page", () => {
  it.each(records.filter((record) => record.evidence.length > 0))(
    "shows every line of $id's evidence exactly as the page does",
    ({ evidence }) => {
      const html = renderToStaticMarkup(createElement(EvidenceList, { evidence }));
      const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
      expect(articles).toHaveLength(evidence.length);
      const screen = evidenceText(evidence).map((text: string) => text.replace(/\s+/g, " "));
      articles.forEach((article, index) => {
        const entry = evidence[index];
        const paragraphs = (article.match(/<p[\s\S]*?<\/p>/g) ?? []).map(decode).filter(Boolean);
        expect(paragraphs[0]).toBe(`${entry.label}${entry.title}`.replace(/\s+/g, " ").trim());
        expect(screen[index]).toContain(`[${entry.label}] ${entry.title}`.replace(/\s+/g, " "));
        for (const line of paragraphs.slice(1)) expect(screen[index]).toContain(line);
      });
    },
  );

  it.each(formulationGuides)("shows all of $id's guide text and citation markers", (guide) => {
    const screen = guideBlocksText(guide.blocks);
    for (const block of guide.blocks) {
      if (block.kind === "heading") {
        expect(screen).toContain(block.text);
        continue;
      }
      const spans = block.kind === "paragraph" ? block.spans : block.items.flat();
      for (const span of spans) {
        expect(screen).toContain(span.citation ? `[${span.citation}]` : span.text);
      }
    }
  });
});
