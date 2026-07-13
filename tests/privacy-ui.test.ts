import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import { PrivacyInputNotice } from "@/components/privacy-input-notice";

describe("privacy UI", () => {
  it("renders a persistent, keyboard-reachable privacy warning and product link", () => {
    const markup = renderToStaticMarkup(createElement(PrivacyInputNotice));

    expect(markup).toContain("Do not enter patient-identifiable information.");
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain("Privacy and data processing");
  });

  it("publishes an accessible governance-review draft covering configured data processing", () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPage));

    expect(markup).toContain("<main");
    expect(markup).toContain("<h1");
    expect(markup).toContain("Privacy &amp; data handling");
    expect(markup).toContain("This is draft product information");
    for (const heading of [
      "What this tool is",
      "What is collected",
      "How questions are handled",
      "Where data is stored",
      "External provider processing",
      "Retention",
      "Your responsibilities",
    ]) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain("Generated answer text is also omitted from durable query logs by default");
    expect(markup).not.toContain("approved privacy policy");
  });
});
