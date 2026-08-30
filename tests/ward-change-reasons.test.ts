// tests/ward-change-reasons.test.ts
import { describe, expect, it } from "vitest";

import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  ESCALATION_CONTACTS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_HOLD_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  type CancelTransportReason,
  type LegalStatusChangeReason,
  type ReleaseHoldReason,
  type UrgencyChangeReason,
  type UrgentMarkReason,
} from "../src/components/ward-management/ward-change-reasons";

describe("ward-change-reasons", () => {
  it("holds exactly the three urgency-change reasons, in this order", () => {
    expect(URGENCY_CHANGE_REASONS).toEqual(["reassessed", "new_information", "correcting_an_error"]);
  });

  it("holds exactly the two legal-status-change reasons, in this order", () => {
    expect(LEGAL_STATUS_CHANGE_REASONS).toEqual(["recorded_by_treating_team", "correcting_an_error"]);
  });

  // Task 3: the undo the prototype has never had. Same discipline, same pinned order.
  it("holds exactly the four release-hold reasons, in this order", () => {
    expect(RELEASE_HOLD_REASONS).toEqual([
      "patient_no_longer_coming",
      "bed_needed_for_another_patient",
      "ward_withdrew_the_bed",
      "hold_made_in_error",
    ]);
  });

  it("holds exactly the four cancel-transport reasons, in this order", () => {
    expect(CANCEL_TRANSPORT_REASONS).toEqual([
      "provider_unavailable",
      "patient_not_ready",
      "destination_changed",
      "job_created_in_error",
    ]);
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

  it("labels every release-hold reason with real, non-empty text", () => {
    for (const reason of RELEASE_HOLD_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  it("labels every cancel-transport reason with real, non-empty text", () => {
    for (const reason of CANCEL_TRANSPORT_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  // Task 6 (spec item 11): the escalation contact, chosen never typed. Pinned order matches the
  // exact product-owner list from the brief — "Other service" is the one deliberate general
  // entry, never a seventh entry and never reworded.
  it("holds exactly the six escalation contacts, in this order", () => {
    expect(ESCALATION_CONTACTS).toEqual([
      "State bed coordination desk",
      "Duty psychiatrist",
      "Bed management",
      "Nurse unit manager (destination ward)",
      "Escort or transport provider",
      "Other service",
    ]);
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
      // Task 6: ESCALATION_CONTACTS carries no separate label map (its values ARE the rendered
      // text — see the comment above its definition), so it is checked here directly rather than
      // through changeReasonLabels.
      ...ESCALATION_CONTACTS,
    ].map((value) => value.toLowerCase());

    for (const text of allText) {
      for (const token of forbiddenTokens) {
        expect(text.includes(token), `"${text}" contains the forbidden token "${token}"`).toBe(false);
      }
    }
  });

  it("gives every union member a label and no label an orphan entry", () => {
    const allReasons: (
      UrgencyChangeReason | LegalStatusChangeReason | ReleaseHoldReason | CancelTransportReason | UrgentMarkReason
    )[] = [
      ...URGENCY_CHANGE_REASONS,
      ...LEGAL_STATUS_CHANGE_REASONS,
      ...RELEASE_HOLD_REASONS,
      ...CANCEL_TRANSPORT_REASONS,
      ...URGENT_MARK_REASONS,
    ];
    // Every reason in all four lists resolves to a label.
    for (const reason of allReasons) {
      expect(Object.keys(changeReasonLabels)).toContain(reason);
    }
    // "correcting_an_error" is shared by the urgency and legal-status lists, so the label map has
    // exactly TWELVE unique keys, not thirteen — this pins that de-duplication rather than letting
    // a stray extra key (a typo'd duplicate) slip in unnoticed. Task 3's two new lists (Release
    // Hold, Cancel Transport) share no value with any other list, so each of their eight entries
    // adds exactly one key.
    expect(Object.keys(changeReasonLabels).sort()).toEqual(
      [
        "correcting_an_error",
        "new_information",
        "reassessed",
        "recorded_by_treating_team",
        "patient_no_longer_coming",
        "bed_needed_for_another_patient",
        "ward_withdrew_the_bed",
        "hold_made_in_error",
        "provider_unavailable",
        "patient_not_ready",
        "destination_changed",
        "job_created_in_error",
        // The ten PLACEHOLDER urgent-mark reasons (owner asked for ten to build against,
        // 2026-08-30; he has not chosen them). Pinned here for the same reason as every other
        // entry: an added or renamed reason must turn this red rather than arrive quietly. When he
        // supplies the real ones, this block and the list in ward-change-reasons.ts change together.
        "one_to_one_observation_needed",
        "cannot_be_observed_safely_here",
        "no_psychiatric_cover_at_this_site",
        "restrictive_measures_this_setting_cannot_sustain",
        "cannot_safely_prevent_leaving",
        "needs_medical_care_unavailable_here",
        "safety_of_others_in_this_setting",
        "escort_in_place_and_unsustainable",
        "earlier_placement_broke_down",
        "this_setting_cannot_continue_current_care",
      ].sort(),
    );
  });
});
