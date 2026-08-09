import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SharedHomeEmptyState } from "@/components/clinical-dashboard/answer-status";
import { appModeIds, type AppModeId } from "@/lib/app-modes";

const expectedPresentations = [
  {
    modeId: "answer",
    title: "What can I help with?",
    subtitle: "Ask a source-backed clinical question.",
    iconClass: "lucide-sparkles",
  },
  {
    modeId: "documents",
    title: "Find a source?",
    subtitle: "Search documents and evidence passages.",
    iconClass: "lucide-file-text",
  },
  {
    modeId: "services",
    title: "Find a service?",
    subtitle: "Search services and referral pathways.",
    iconClass: "lucide-route",
  },
  {
    modeId: "forms",
    title: "Find a form?",
    subtitle: "Search clinical forms and pathways.",
    iconClass: "lucide-file-pen-line",
  },
  {
    modeId: "favourites",
    title: "Find a saved item?",
    subtitle: "Search your saved clinical items.",
    iconClass: "lucide-heart",
  },
  {
    modeId: "differentials",
    title: "What else could it be?",
    subtitle: "Compare causes and clinical clues.",
    iconClass: "lucide-brain-circuit",
  },
  {
    modeId: "dsm",
    title: "Check DSM-5 criteria?",
    subtitle: "Search diagnoses, criteria, and codes.",
    iconClass: "lucide-book-open-check",
  },
  {
    modeId: "specifiers",
    title: "Which specifier fits?",
    subtitle: "Refine diagnostic wording and episode patterns.",
    iconClass: "lucide-tags",
  },
  {
    modeId: "formulation",
    title: "What explains the pattern?",
    subtitle: "Explore mechanisms behind the presentation.",
    iconClass: "lucide-network",
  },
  {
    modeId: "prescribing",
    title: "Check a medication?",
    subtitle: "Check dosing, safety, and monitoring.",
    iconClass: "lucide-pill",
  },
  {
    modeId: "tools",
    title: "Find a clinical tool?",
    subtitle: "Search clinical tools and applications.",
    iconClass: "lucide-wrench",
  },
  {
    modeId: "therapy-compass",
    title: "Which therapy fits?",
    subtitle: "Explore source-grounded therapy guidance.",
    iconClass: "lucide-compass",
  },
  {
    modeId: "factsheets",
    title: "Find a patient factsheet?",
    subtitle: "Search clear patient information to share.",
    iconClass: "lucide-book-open-text",
  },
] as const satisfies ReadonlyArray<{
  modeId: AppModeId;
  title: string;
  subtitle: string;
  iconClass: string;
}>;

describe("SharedHomeEmptyState", () => {
  it("covers every current app mode exactly once", () => {
    expect(expectedPresentations.map(({ modeId }) => modeId)).toEqual(appModeIds);
  });

  it.each(expectedPresentations)(
    "renders the canonical $modeId presentation",
    ({ modeId, title, subtitle, iconClass }) => {
      const { container } = render(<SharedHomeEmptyState modeId={modeId} />);

      expect(screen.getByTestId("shared-home-empty-state")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
      expect(screen.getByText(subtitle, { exact: true })).toBeInTheDocument();

      const icon = container.querySelector(".mode-home-icon svg");
      expect(icon).toHaveClass(iconClass);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    },
  );

  it("updates the same shared-home root when the active mode changes", () => {
    const { rerender } = render(<SharedHomeEmptyState modeId="answer" />);
    const sharedHomeRoot = screen.getByTestId("shared-home-empty-state");

    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-sparkles");

    rerender(<SharedHomeEmptyState modeId="services" />);

    expect(screen.getByTestId("shared-home-empty-state")).toBe(sharedHomeRoot);
    expect(screen.getByRole("heading", { level: 2, name: "Find a service?" })).toBeInTheDocument();
    expect(screen.getByText("Search services and referral pathways.", { exact: true })).toBeInTheDocument();
    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-route");
    expect(screen.queryByText("What can I help with?", { exact: true })).not.toBeInTheDocument();
  });
});
