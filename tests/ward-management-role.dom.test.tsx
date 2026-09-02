import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Ward Flow role screens unique test id contract", () => {
  it("renders exactly one ward-unit-screen element for a valid unit id", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="bty-adult-secure" />
      </WardFlowProvider>,
    );

    const screens = screen.getAllByTestId("ward-unit-screen");
    expect(screens).toHaveLength(1);
    expect(screen.getByTestId("ward-unit-screen")).toBeInTheDocument();
    expect(screen.getByTestId("ward-unit-screen")).toHaveTextContent("BTY Adult Secure");
  });

  it("renders exactly one ward-unit-screen element for an unresolved unit id", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="nonexistent-unit-xyz" />
      </WardFlowProvider>,
    );

    const screens = screen.getAllByTestId("ward-unit-screen");
    expect(screens).toHaveLength(1);
    expect(screen.getByTestId("ward-unit-unresolved")).toBeInTheDocument();
    expect(screen.getByTestId("ward-unit-screen")).toHaveTextContent("nonexistent-unit-xyz");
  });

  it("renders exactly one ward-ed-screen element for a valid emergency department id", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="jhc-ed" />
      </WardFlowProvider>,
    );

    const screens = screen.getAllByTestId("ward-ed-screen");
    expect(screens).toHaveLength(1);
    expect(screen.getByTestId("ward-ed-screen")).toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-screen")).toHaveTextContent(/emergency department/i);
  });

  it("renders exactly one ward-ed-screen element for an unresolved emergency department id", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="nonexistent-ed-xyz" />
      </WardFlowProvider>,
    );

    const screens = screen.getAllByTestId("ward-ed-screen");
    expect(screens).toHaveLength(1);
    expect(screen.getByTestId("ward-ed-unresolved")).toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-screen")).toHaveTextContent("nonexistent-ed-xyz");
  });

  it("renders exactly one ward-officer-screen element for transport officer view", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const screens = screen.getAllByTestId("ward-officer-screen");
    expect(screens).toHaveLength(1);
    expect(screen.getByTestId("ward-officer-screen")).toBeInTheDocument();
  });
});
