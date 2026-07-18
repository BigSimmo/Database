import { describe, expect, it } from "vitest";

import {
  ANSWER_STYLE_OPTIONS,
  DEFAULT_PREFERENCES,
  DENSITY_OPTIONS,
  JURISDICTION_OPTIONS,
  LANDING_OPTIONS,
  POPULATION_OPTIONS,
  normalizePreferences,
} from "../src/components/clinical-dashboard/use-app-preferences";

describe("app preference normalisation", () => {
  it("returns defaults for non-object or empty input", () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences("nope")).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences([])).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid stored values", () => {
    const stored = {
      density: "compact",
      motion: "reduced",
      jurisdiction: "nsw",
      population: "older-adults",
      answerStyle: "comprehensive",
      landing: "search",
      showRecentOnHome: false,
      showProtocolsOnHome: false,
      compactCitations: true,
      notifyGuidelineUpdates: false,
      notifyProductNews: true,
      notifySavedChanges: false,
    };
    expect(normalizePreferences(stored)).toEqual(stored);
  });

  it("falls back per-field when individual values are invalid", () => {
    const result = normalizePreferences({
      density: "microscopic",
      motion: 3,
      jurisdiction: "atlantis",
      population: null,
      answerStyle: "chatty",
      landing: "teleport",
      showRecentOnHome: "yes",
      compactCitations: 1,
    });
    expect(result.density).toBe(DEFAULT_PREFERENCES.density);
    expect(result.motion).toBe(DEFAULT_PREFERENCES.motion);
    expect(result.jurisdiction).toBe(DEFAULT_PREFERENCES.jurisdiction);
    expect(result.population).toBe(DEFAULT_PREFERENCES.population);
    expect(result.answerStyle).toBe(DEFAULT_PREFERENCES.answerStyle);
    expect(result.landing).toBe(DEFAULT_PREFERENCES.landing);
    expect(result.showRecentOnHome).toBe(DEFAULT_PREFERENCES.showRecentOnHome);
    expect(result.compactCitations).toBe(DEFAULT_PREFERENCES.compactCitations);
  });

  it("keeps every default within its published option set", () => {
    expect(DENSITY_OPTIONS.some((option) => option.value === DEFAULT_PREFERENCES.density)).toBe(true);
    expect(POPULATION_OPTIONS.some((option) => option.value === DEFAULT_PREFERENCES.population)).toBe(true);
    expect(ANSWER_STYLE_OPTIONS.some((option) => option.value === DEFAULT_PREFERENCES.answerStyle)).toBe(true);
    expect(LANDING_OPTIONS.some((option) => option.value === DEFAULT_PREFERENCES.landing)).toBe(true);
    expect(JURISDICTION_OPTIONS.some((option) => option.value === DEFAULT_PREFERENCES.jurisdiction)).toBe(true);
  });
});
