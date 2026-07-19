import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnswerEmptyState } from "@/components/clinical-dashboard/answer-status";
import { sourceCapsuleDisplay } from "@/components/clinical-dashboard/answer-content";
import { DEFAULT_PREFERENCES, landingModeForPreference } from "@/components/clinical-dashboard/use-app-preferences";

// Behavior coverage for the preferences wired on 2026-07-19: "Recent searches
// on home" gates the AnswerEmptyState chips, "Compact citations" drops the
// source-capsule text label (never the missing-source warning), and "Default
// landing view" maps onto a dashboard mode for the shell's one-shot redirect.

const PREFERENCES_KEY = "clinical-kb-preferences";

function storePreferences(overrides: Record<string, unknown>) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, ...overrides }));
}

function renderEmptyState() {
  return render(
    <AnswerEmptyState
      onSearchDocuments={() => {}}
      onUploadDocument={() => {}}
      recentQueries={["clozapine monitoring", "lithium levels"]}
      onSelectRecent={vi.fn()}
    />,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe("recent searches on home preference", () => {
  it("shows recent-query chips when the preference is on (default)", () => {
    storePreferences({ showRecentOnHome: true });
    renderEmptyState();
    expect(screen.getByTestId("answer-recent-queries")).toBeInTheDocument();
    expect(screen.getByText("clozapine monitoring")).toBeInTheDocument();
  });

  it("hides recent-query chips when the preference is off", () => {
    storePreferences({ showRecentOnHome: false });
    renderEmptyState();
    expect(screen.queryByTestId("answer-recent-queries")).not.toBeInTheDocument();
    expect(screen.queryByText("clozapine monitoring")).not.toBeInTheDocument();
  });
});

describe("compact citations capsule display", () => {
  it("keeps the Sources label when compact is off", () => {
    expect(sourceCapsuleDisplay({ sourceCount: 3, compact: false })).toEqual({
      label: "Sources",
      showLabelText: true,
      showCountBadge: true,
    });
  });

  it("drops the label text but keeps the count when compact is on", () => {
    expect(sourceCapsuleDisplay({ sourceCount: 3, compact: true })).toEqual({
      label: "Sources",
      showLabelText: false,
      showCountBadge: true,
    });
  });

  it("never hides the missing-source warning, even in compact mode", () => {
    expect(sourceCapsuleDisplay({ sourceCount: 0, compact: true })).toEqual({
      label: "No direct source found",
      showLabelText: true,
      showCountBadge: false,
    });
  });
});

describe("default landing view mapping", () => {
  it("maps search to the documents mode and browse to the tools mode", () => {
    expect(landingModeForPreference("search")).toBe("documents");
    expect(landingModeForPreference("browse")).toBe("tools");
  });

  it("returns null for ask (the built-in default needs no override)", () => {
    expect(landingModeForPreference("ask")).toBeNull();
  });
});
