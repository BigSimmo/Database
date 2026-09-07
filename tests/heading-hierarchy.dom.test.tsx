/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuideDialog } from "@/components/clinical-dashboard/guide-dialog";
import { guideTopicById } from "@/components/clinical-dashboard/guide-content";
import { ToolsPageMockupPage } from "@/components/tools-page-mockups/tools-page-mockup-page";
import { SectionHeading } from "@/components/ui/section-heading";

// Mock next/navigation for GuideDialog (router, pathname, searchParams)
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link for ToolsPageMockupPage
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  routerPush.mockReset();
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 60));
  });
});

describe("heading hierarchy contract — #WKFSV6", () => {
  describe("GuideDialog modal heading hierarchy", () => {
    it("preserves section h2 and nested card h3 in home view", () => {
      render(<GuideDialog open onClose={vi.fn()} />);
      const dialog = screen.getByRole("dialog", { name: "PsychSift guide" });

      // Major sections within the guide own h2
      const h2Elements = dialog.querySelectorAll("h2");
      expect(h2Elements.length).toBeGreaterThanOrEqual(3);

      const h2Texts = Array.from(h2Elements).map((el) => el.textContent?.trim());
      expect(h2Texts).toContain("PsychSift Guide Centre");
      expect(h2Texts).toContain("What do you need help with?");
      expect(h2Texts).toContain("How to verify an answer");

      // Child action cards and illustrative sections own h3, never promoted to h2
      const h3Elements = dialog.querySelectorAll("h3");
      expect(h3Elements.length).toBeGreaterThanOrEqual(1);

      const h3Texts = Array.from(h3Elements).map((el) => el.textContent?.trim());
      expect(h3Texts).toContain("Check each claim, not just the summary");

      // Verify that child cards are not flattened into h2
      expect(h2Texts).not.toContain("Check each claim, not just the summary");

      // No h1 inside dialog — dialogs nest within page context, never compete with page h1
      expect(dialog.querySelectorAll("h1")).toHaveLength(0);
    });

    it("keeps topic page heading at h2 and all content sections at h3 without flattening", async () => {
      const user = userEvent.setup();
      render(<GuideDialog open onClose={vi.fn()} />);

      // Navigate to a topic via QuickTasks button
      const quickTaskButton = screen.getByRole("button", { name: /Ask a better question/i });
      await user.click(quickTaskButton);

      const dialog = screen.getByRole("dialog", { name: "PsychSift guide" });
      const topic = guideTopicById["ask-better-questions"];

      // Topic title is the active view heading at h2
      const topicHeading = dialog.querySelector("[data-guide-page-heading]");
      expect(topicHeading?.tagName.toLowerCase()).toBe("h2");
      expect(topicHeading?.textContent?.trim()).toBe(topic.title);

      // Every subsection inside the topic is h3
      for (const section of topic.sections) {
        const sectionHeading = within(dialog).getByRole("heading", { level: 3, name: section.heading });
        expect(sectionHeading).toBeInTheDocument();
        expect(sectionHeading.tagName.toLowerCase()).toBe("h3");
      }

      // No content section under the topic may be promoted to h2 (which would flatten the topic outline)
      for (const section of topic.sections) {
        expect(within(dialog).queryByRole("heading", { level: 2, name: section.heading })).toBeNull();
      }
    });

    it("keeps tour step heading at h2 and step sub-sections at h3", async () => {
      const user = userEvent.setup();
      render(<GuideDialog open onClose={vi.fn()} />);

      // Navigate to guided tour via top navigation button
      const tourButton = screen.getByRole("button", { name: "Guided tour" });
      await user.click(tourButton);

      const dialog = screen.getByRole("dialog", { name: "PsychSift guide" });

      // Active step focus heading is h2
      const stepHeading = dialog.querySelector("[data-guide-page-heading]");
      expect(stepHeading?.tagName.toLowerCase()).toBe("h2");

      // Subsections within the step are h3, preventing flattening of the tour outline
      const subHeadings = dialog.querySelectorAll("h3");
      expect(subHeadings.length).toBeGreaterThanOrEqual(1);
      for (const heading of subHeadings) {
        expect(heading.tagName.toLowerCase()).toBe("h3");
      }
    });
  });

  describe("Mockup gallery surfaces heading hierarchy", () => {
    it("preserves Page h1 -> Section h2 -> Card h3 hierarchy in ToolsPageMockupPage command-center", () => {
      render(<ToolsPageMockupPage variant="command-center" />);

      // Exactly one page-level h1
      const h1Elements = document.querySelectorAll("h1");
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0].textContent).toContain("Tools command center");

      // Gallery sections own h2
      const h2Elements = document.querySelectorAll("h2");
      expect(h2Elements.length).toBeGreaterThanOrEqual(3);
      const h2Texts = Array.from(h2Elements).map((el) => el.textContent?.trim());
      expect(h2Texts).toContain("Start here");
      expect(h2Texts).toContain("All tools");
      expect(h2Texts).toContain("Recent work");

      // Individual tool cards own h3, preventing flattening into section outline
      const h3Elements = document.querySelectorAll("h3");
      expect(h3Elements.length).toBeGreaterThanOrEqual(5);

      // Tool card titles must NOT be h2
      for (const h3 of h3Elements) {
        const text = h3.textContent?.trim();
        if (text) {
          expect(h2Texts).not.toContain(text);
        }
      }
    });

    it("preserves Page h1 -> Section h2 -> Card h3 hierarchy in ToolsPageMockupPage workflow-board", () => {
      render(<ToolsPageMockupPage variant="workflow-board" />);

      // Exactly one page-level h1
      const h1Elements = document.querySelectorAll("h1");
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0].textContent).toContain("Workflow board");

      // Sections own h2 (lanes, review queue, daily pins, all tools)
      const h2Elements = document.querySelectorAll("h2");
      expect(h2Elements.length).toBeGreaterThanOrEqual(4);
      const h2Texts = Array.from(h2Elements).map((el) => el.textContent?.trim());
      expect(h2Texts).toContain("Assess");
      expect(h2Texts).toContain("Review queue");
      expect(h2Texts).toContain("Daily pins");
      expect(h2Texts).toContain("All tools");

      // Tool cards own h3
      const h3Elements = document.querySelectorAll("h3");
      expect(h3Elements.length).toBeGreaterThanOrEqual(5);
    });

    it("preserves Page h1 -> Section h2 -> Card h3 hierarchy in ToolsPageMockupPage split-pane", () => {
      render(<ToolsPageMockupPage variant="split-pane" />);

      // Exactly one page-level h1
      const h1Elements = document.querySelectorAll("h1");
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0].textContent).toContain("Tools directory");

      // Sections own h2
      const h2Elements = document.querySelectorAll("h2");
      expect(h2Elements.length).toBeGreaterThanOrEqual(1);

      // Tool cards own h3
      const h3Elements = document.querySelectorAll("h3");
      expect(h3Elements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("SectionHeading and Dialog/Sheet heading level contract", () => {
    it("renders level 2 by default for top-level section landmarks", () => {
      render(<SectionHeading title="Clinical Governance" />);
      const heading = screen.getByRole("heading", { level: 2, name: "Clinical Governance" });
      expect(heading.tagName.toLowerCase()).toBe("h2");
    });

    it("supports headingLevel 3 for nested modal, sheet, or sub-section headings", () => {
      render(
        <section aria-labelledby="parent-section">
          <SectionHeading id="parent-section" title="Main Section" headingLevel={2} />
          <div role="region" aria-labelledby="nested-popup">
            <SectionHeading id="nested-popup" title="Evidence Popup" headingLevel={3} />
          </div>
        </section>,
      );

      const h2 = screen.getByRole("heading", { level: 2, name: "Main Section" });
      const h3 = screen.getByRole("heading", { level: 3, name: "Evidence Popup" });

      expect(h2.tagName.toLowerCase()).toBe("h2");
      expect(h3.tagName.toLowerCase()).toBe("h3");

      // Confirms child popup heading is not an h2, preventing flattening of the accessibility tree
      expect(screen.queryByRole("heading", { level: 2, name: "Evidence Popup" })).toBeNull();
    });
  });
});
