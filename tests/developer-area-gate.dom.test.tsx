import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `DeveloperAreaGate` is the administrator gate every /mockups/development,
 * /mockups/caring-contacts, /mockups/care-plan and /mockups/ward-flow layout
 * wraps its children in. #L30 was a single public build-time flag
 * (`NEXT_PUBLIC_MOCKUPS_ENABLED=true`), set alone, disabling the gate in
 * production. `tests/developer-area-access.test.ts` proves the pure
 * `developerGateBypassAllowed()` predicate directly; this file proves the
 * gate component actually consults it — and falls through to
 * `resolveDeveloperAccessState()` otherwise — end to end.
 */

const mocks = vi.hoisted(() => ({
  bypassAllowed: false,
  accessResult: {
    state: "authorized" as "authorized" | "unauthenticated" | "unauthorized",
    email: null as string | null,
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("@/lib/developer-area/access", () => ({
  developerGateBypassAllowed: vi.fn(() => mocks.bypassAllowed),
  resolveDeveloperAccessState: vi.fn(async () => mocks.accessResult),
}));

vi.mock("@/components/developer-area/developer-gate-screen", () => ({
  DeveloperGateScreen: ({ state }: { state: string }) => <div data-testid="gate-screen">{state}</div>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.bypassAllowed = false;
  mocks.accessResult = { state: "authorized", email: null };
});

describe("DeveloperAreaGate", () => {
  it("renders children without checking access when developerGateBypassAllowed() reports true", async () => {
    mocks.bypassAllowed = true;
    const { developerGateBypassAllowed, resolveDeveloperAccessState } = await import("@/lib/developer-area/access");
    const { DeveloperAreaGate } = await import("@/components/developer-area/developer-area-gate");

    render(await DeveloperAreaGate({ children: <p data-testid="protected">secret</p> }));

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(developerGateBypassAllowed).toHaveBeenCalledTimes(1);
    expect(resolveDeveloperAccessState).not.toHaveBeenCalled();
  });

  it("renders children when the bypass is refused but resolveDeveloperAccessState reports authorized", async () => {
    mocks.bypassAllowed = false;
    mocks.accessResult = { state: "authorized", email: "josh@stoicable.com" };
    const { DeveloperAreaGate } = await import("@/components/developer-area/developer-area-gate");

    render(await DeveloperAreaGate({ children: <p data-testid="protected">secret</p> }));

    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("shows the sign-in screen instead of children when the bypass is refused and the visitor is unauthenticated (#L30)", async () => {
    mocks.bypassAllowed = false;
    mocks.accessResult = { state: "unauthenticated", email: null };
    const { DeveloperAreaGate } = await import("@/components/developer-area/developer-area-gate");

    render(await DeveloperAreaGate({ children: <p data-testid="protected">secret</p> }));

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByTestId("gate-screen")).toHaveTextContent("unauthenticated");
  });

  it("shows the access-denied screen for a signed-in non-administrator", async () => {
    mocks.bypassAllowed = false;
    mocks.accessResult = { state: "unauthorized", email: "someone-else@example.com" };
    const { DeveloperAreaGate } = await import("@/components/developer-area/developer-area-gate");

    render(await DeveloperAreaGate({ children: <p data-testid="protected">secret</p> }));

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByTestId("gate-screen")).toHaveTextContent("unauthorized");
  });
});
