import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SharedHomeEmptyState } from "@/components/clinical-dashboard/answer-status";
import { appModeIds, type AppModeId } from "@/lib/app-modes";

const expectedPresentations = [
  {
    modeId: "answer",
    title: "Clinical Answers",
    iconClass: "lucide-sparkles",
  },
  {
    modeId: "documents",
    title: "Clinical Documents",
    iconClass: "lucide-file-text",
  },
  {
    modeId: "services",
    title: "Clinical Services",
    iconClass: "lucide-route",
  },
  {
    modeId: "forms",
    title: "Clinical Forms",
    iconClass: "lucide-file-pen-line",
  },
  {
    modeId: "favourites",
    title: "Clinical Favourites",
    iconClass: "lucide-heart",
  },
  {
    modeId: "differentials",
    title: "Differential Diagnosis",
    iconClass: "lucide-brain-circuit",
  },
  {
    modeId: "dsm",
    title: "DSM-5 Diagnosis",
    iconClass: "lucide-book-open-check",
  },
  {
    modeId: "specifiers",
    title: "Diagnostic Specifiers",
    iconClass: "lucide-tags",
  },
  {
    modeId: "formulation",
    title: "Clinical Formulation",
    iconClass: "lucide-network",
  },
  {
    modeId: "prescribing",
    title: "Medication Guidance",
    iconClass: "lucide-pill",
  },
  {
    modeId: "tools",
    title: "Clinical Tools",
    iconClass: "lucide-wrench",
  },
  {
    modeId: "therapy-compass",
    title: "Therapy Compass",
    iconClass: "lucide-compass",
  },
  {
    modeId: "factsheets",
    title: "Patient Factsheets",
    iconClass: "lucide-book-open-text",
  },
] as const satisfies ReadonlyArray<{
  modeId: AppModeId;
  title: string;
  iconClass: string;
}>;

describe("SharedHomeEmptyState", () => {
  it("covers every current app mode exactly once", () => {
    expect(expectedPresentations.map(({ modeId }) => modeId)).toEqual(appModeIds);
  });

  it.each(expectedPresentations)("renders the canonical $modeId presentation", ({ modeId, title, iconClass }) => {
    const { container } = render(<SharedHomeEmptyState modeId={modeId} />);

    expect(screen.getByTestId("shared-home-empty-state")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(container.querySelector("h2 + p")).not.toBeInTheDocument();

    const icon = container.querySelector(".mode-home-icon svg");
    expect(icon).toHaveClass(iconClass);
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("updates the same shared-home root when the active mode changes", () => {
    const { rerender } = render(<SharedHomeEmptyState modeId="answer" />);
    const sharedHomeRoot = screen.getByTestId("shared-home-empty-state");

    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-sparkles");

    rerender(<SharedHomeEmptyState modeId="services" />);

    expect(screen.getByTestId("shared-home-empty-state")).toBe(sharedHomeRoot);
    expect(screen.getByRole("heading", { level: 2, name: "Clinical Services" })).toBeInTheDocument();
    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-route");
    expect(screen.queryByText("What can I help with?", { exact: true })).not.toBeInTheDocument();
  });
});
