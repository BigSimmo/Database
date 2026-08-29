import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import { clinicalAskModeIds } from "@/lib/clinical-ask/contracts";
import { resolveSmartSearchSubmissionIntent } from "@/lib/smart-search-intent";

describe("resolveSmartSearchSubmissionIntent", () => {
  it.each(clinicalAskModeIds)("routes explicit questions to governed Clinical Ask in %s", (mode) => {
    expect(resolveSmartSearchSubmissionIntent(mode, "Which option is best for this presentation?")).toBe(
      "clinical-ask",
    );
    expect(resolveSmartSearchSubmissionIntent(mode, "How should this be approached")).toBe("clinical-ask");
  });

  it.each(clinicalAskModeIds)("routes developed clinical case statements to Clinical Ask in %s", (mode) => {
    expect(resolveSmartSearchSubmissionIntent(mode, "presentation is persistent and worse after discharge")).toBe(
      "clinical-ask",
    );
    expect(
      resolveSmartSearchSubmissionIntent(mode, "consider the most appropriate pathway for ongoing community care"),
    ).toBe("clinical-ask");
  });

  it.each(clinicalAskModeIds)("keeps catalogue phrases, codes, commands, and fragments in search for %s", (mode) => {
    for (const query of [
      "cognitive therapy for anxiety",
      "DBT for borderline personality disorder",
      "services for young people",
      "best interests form",
      "form 4A?",
      "find crisis services",
      "look up section 26",
      "community treatment order",
      "Services are available for young people in Perth",
      "Forms are used for community treatment orders",
      "Cognitive therapy is used for anxiety disorders",
      "persistent symptoms after",
    ]) {
      expect(resolveSmartSearchSubmissionIntent(mode, query), query).toBe("search");
    }
  });

  it.each(appModeIds.filter((mode) => !clinicalAskModeIds.includes(mode as never)))(
    "never invokes Clinical Ask in unsupported mode %s",
    (mode) => {
      expect(resolveSmartSearchSubmissionIntent(mode, "Which option is best for this presentation?")).toBe("search");
      expect(resolveSmartSearchSubmissionIntent(mode, "presentation is persistent and worse after discharge")).toBe(
        "search",
      );
    },
  );
});
