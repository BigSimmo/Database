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
      "Where data is stored and processed",
      "External provider processing",
      "Retention",
      "Your responsibilities",
    ]) {
      expect(markup).toContain(heading);
    }
    // JSX drops a newline adjacent to a tag, so the space after the bolded
    // phrase must be explicit or this renders as "systemand".
    expect(markup).toContain("not a patient-record system</strong> and its provider-backed features");
    expect(markup).toContain("deliberately omits a patient-identifier field");
    expect(markup).toContain("Safety-plan working content has no Clinical KB retention");
    expect(markup).toContain("Clipboard, print, and PDF copies are outside the app");
    expect(markup).toContain("Generated answer text is also omitted from durable query logs by default");
    expect(markup).toContain("application service in Singapore");
    expect(markup).toContain("Railway in Singapore");
    expect(markup).toContain("retrieval embedding");
    expect(markup).toContain("even when the final response is source-only");
    expect(markup).toContain("bounded hourly purge of expired response-cache rows");
    expect(markup).not.toContain("approved privacy policy");
  });
});
