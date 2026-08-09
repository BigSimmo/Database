import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DifferentialStreamPage } from "@/components/differentials/differential-stream-page";
import { differentialPresentationsCards } from "@/lib/differentials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/differentials/presentations",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("DifferentialStreamPage presentations stream", () => {
  it("renders the presentations catalogue heading and entry cards", () => {
    render(<DifferentialStreamPage stream="presentations" />);

    expect(screen.getByText("Differentials: Presentations")).toBeInTheDocument();
    expect(screen.getByText("Presentation-focused differential content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Clinical entries" })).toBeInTheDocument();

    const firstCard = differentialPresentationsCards[0];
    expect(firstCard).toBeTruthy();
    expect(screen.getByRole("button", { name: firstCard!.title })).toBeInTheDocument();
  });
});
