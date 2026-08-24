// tests/ward-change-reasons.test.ts
import { describe, expect, it } from "vitest";

import {
  changeReasonLabels,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  type LegalStatusChangeReason,
  type UrgencyChangeReason,
} from "../src/components/ward-management/ward-change-reasons";

describe("ward-change-reasons", () => {
  it("holds exactly the three urgency-change reasons, in this order", () => {
    expect(URGENCY_CHANGE_REASONS).toEqual(["reassessed", "new_information", "correcting_an_error"]);
  });

  it("holds exactly the two legal-status-change reasons, in this order", () => {
    expect(LEGAL_STATUS_CHANGE_REASONS).toEqual(["recorded_by_treating_team", "correcting_an_error"]);
  });

  it("labels every urgency-change reason with real, non-empty text", () => {
    for (const reason of URGENCY_CHANGE_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  it("labels every legal-status-change reason with real, non-empty text", () => {
    for (const reason of LEGAL_STATUS_CHANGE_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  // Content-free, synthetic-data guard: none of the eight rulings in the brief permits a reason
  // describing a patient, a diagnosis, a clinical judgement or a legal requirement. This asserts
  // it structurally rather than trusting a comment — a reason string is never free text (every
  // reason picker in this task is a `<select>` over these fixed lists), so this check on the
  // fixed lists themselves is a check on every reason the product can ever record.
  it("never names a clinical, diagnostic or statutory concept in a reason value or label", () => {
    const forbiddenTokens = [
      "patient",
      "diagnos",
      "deteriorat",
      "order made",
      "section",
      "act 2014",
      "mental health act",
      "detained",
      "involuntary",
    ];
    const allText = [
      ...URGENCY_CHANGE_REASONS,
      ...LEGAL_STATUS_CHANGE_REASONS,
      ...Object.values(changeReasonLabels),
    ].map((value) => value.toLowerCase());

    for (const text of allText) {
      for (const token of forbiddenTokens) {
        expect(text.includes(token), `"${text}" contains the forbidden token "${token}"`).toBe(false);
      }
    }
  });

  it("gives every union member a label and no label an orphan entry", () => {
    const allReasons: (UrgencyChangeReason | LegalStatusChangeReason)[] = [
      ...URGENCY_CHANGE_REASONS,
      ...LEGAL_STATUS_CHANGE_REASONS,
    ];
    // Every reason in both lists resolves to a label.
    for (const reason of allReasons) {
      expect(Object.keys(changeReasonLabels)).toContain(reason);
    }
    // "correcting_an_error" is shared by both lists, so the label map has exactly THREE unique
    // keys, not four — this pins that de-duplication rather than letting a stray fourth key (a
    // typo'd duplicate) slip in unnoticed.
    expect(Object.keys(changeReasonLabels).sort()).toEqual(
      ["correcting_an_error", "new_information", "reassessed", "recorded_by_treating_team"].sort(),
    );
  });
});
