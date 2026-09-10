import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import { differentialPresentations, differentialRecords, type DifferentialRecord } from "@/lib/differentials";

const copyText = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>(async () => undefined));
vi.mock("@/lib/copy-to-clipboard", () => ({ copyTextToClipboard: copyText }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Keep the actual comparison renderer and copy button; shell navigation and portals are unrelated.
vi.mock("@/components/mode-nav/registry-mode-nav", () => ({ RegistryModeNav: () => null }));
vi.mock("@/components/clinical-dashboard/phone-footer-layer-portal", () => ({
  PhoneFooterLayerPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => copyText.mockClear());

describe("published presentation candidate rendering", () => {
  it("uses novel and revised public diagnoses for comparison, urgency and copied text, and discloses retired candidates", async () => {
    const bundled = differentialRecords.find((record) => record.status !== "emergent")!;
    const retired = differentialRecords.find((record) => record.slug !== bundled.slug)!;
    const novel: DifferentialRecord = {
      ...bundled,
      slug: "new-public-diagnosis",
      title: "New public diagnosis",
      status: "urgent",
    };
    const revised: DifferentialRecord = { ...bundled, title: "Revised public diagnosis", status: "emergent" };
    const workflow = {
      ...differentialPresentations()[0]!,
      id: "new-public-presentation",
      title: "Published presentation",
      selectedCount: 3,
      totalCount: 3,
      safetySnapshot: {
        ...differentialPresentations()[0]!.safetySnapshot,
        tags: [novel.title, retired.title],
      },
      candidates: [novel, revised, retired].map((record) => ({
        ...differentialPresentations()[0]!.candidates[0]!,
        slug: record.slug,
        selected: true,
        comparison: { "must-not-miss": "Published risk", "immediate-action": "Published action" },
      })),
    };
    render(<DifferentialPresentationWorkflowPage workflow={workflow} candidateRecords={[novel, revised]} />);

    expect(screen.getAllByText(novel.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(revised.title).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: `Open diagnosis: ${novel.title}` }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: `Open diagnosis: ${retired.title}` })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Comparison incomplete: 1 diagnosis record(s)");
    expect(screen.getAllByRole("heading", { name: "Selected differentials (2 of 2)" }).length).toBeGreaterThan(0);
    for (const heading of screen.getAllByRole("heading", { name: "Highest urgency" })) {
      const panel = within(heading.closest("section")!);
      expect(panel.getByRole("link", { name: `Open diagnosis: ${revised.title}` })).toBeInTheDocument();
      expect(panel.queryByRole("link", { name: `Open diagnosis: ${novel.title}` })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Copy after review" })[0]!);
    await waitFor(() => expect(copyText).toHaveBeenCalledOnce());
    const copied = copyText.mock.calls[0]![0];
    expect(copied).toContain("New public diagnosis (Urgent): Published risk Immediate action: Published action");
    expect(copied).toContain("Revised public diagnosis (Emergency)");
    expect(copied).toContain("Comparison incomplete: 1 diagnosis record(s)");
    expect(copied).not.toContain(`${retired.title} (`);
  });

  it("does not restore bundled candidates when the initialized public catalogue is empty", async () => {
    const workflow = differentialPresentations()[0]!;
    render(<DifferentialPresentationWorkflowPage workflow={workflow} candidateRecords={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Comparison incomplete: ${workflow.candidates.length} diagnosis record(s)`,
    );
    for (const candidate of workflow.candidates) {
      expect(document.querySelector(`[href="/differentials/diagnoses/${candidate.slug}"]`)).toBeNull();
    }
    expect(document.querySelector('[href^="/differentials/diagnoses/"]')).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Copy after review" })[0]!);
    await waitFor(() => expect(copyText).toHaveBeenCalledOnce());
    expect(copyText.mock.calls[0]![0]).toContain("Comparison incomplete");
  });
});
