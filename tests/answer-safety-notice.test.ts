import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSafetyNotice } from "@/components/answer-safety-notice";
import {
  ANSWER_SAFETY_OBLIGATION,
  ANSWER_SAFETY_PRIVACY_LINK,
  ANSWER_SAFETY_VERIFY,
} from "@/lib/ui-copy";

describe("AnswerSafetyNotice", () => {
  it("keeps pinned APP-5 obligation, privacy link, and verify caveat in card density", () => {
    const markup = renderToStaticMarkup(
      createElement(AnswerSafetyNotice, {
        density: "card",
        testId: "answer-composer-privacy-warning",
      }),
    );

    expect(markup).toContain(ANSWER_SAFETY_OBLIGATION);
    expect(markup).toContain(ANSWER_SAFETY_VERIFY);
    expect(markup).toContain(ANSWER_SAFETY_PRIVACY_LINK);
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('data-density="card"');
    expect(markup).toContain('data-testid="answer-composer-privacy-warning"');
    expect(markup).toContain('role="note"');
  });

  it("keeps the same governance copy in bar density for docked composers", () => {
    const markup = renderToStaticMarkup(
      createElement(AnswerSafetyNotice, {
        density: "bar",
        id: "answer-composer-privacy-warning",
      }),
    );

    expect(markup).toContain(ANSWER_SAFETY_OBLIGATION);
    expect(markup).toContain(ANSWER_SAFETY_VERIFY);
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('data-density="bar"');
    expect(markup).toContain('id="answer-composer-privacy-warning"');
  });
});
