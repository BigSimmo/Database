import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyCompassWorkspace } from "@/components/therapy-compass";
import { clearTherapyDataCache } from "@/components/therapy-compass/data/use-therapy-data";
import { HomeScreen } from "@/components/therapy-compass/screens/home-screen";

const navigation = vi.hoisted(() => ({ pathname: "/therapy-compass" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const therapy = {
  slug: "test-therapy",
  name: "Test therapy",
  category: "Skills based",
  tags: [],
  aliases: [],
  reviewStatus: "reviewed",
};

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

afterEach(() => {
  navigation.pathname = "/therapy-compass";
  clearTherapyDataCache();
  vi.unstubAllGlobals();
});

describe("Therapy Compass required data recovery", () => {
  it("does not advertise a zero therapy count while the catalogue is still loading", async () => {
    let release!: (value: unknown) => void;
    const therapiesGate = new Promise((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/therapies-index.json")) {
        await therapiesGate;
        return response([therapy]);
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Loading therapy library…");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.queryByText(/Source-grounded therapy records\./)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Therapy mode" })).not.toBeInTheDocument();

    release(undefined);

    await waitFor(() => expect(screen.getByText(/1 source-grounded therapy record\./)).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Therapy mode" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.queryByText(/Source-grounded therapy records\./)).not.toBeInTheDocument();
  });

  it("shows an honest load error, retries all required files, and recovers", async () => {
    let failTherapies = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/therapies-index.json")) {
        return failTherapies ? response(null, false, 503) : response([therapy]);
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading therapy library");
    expect(screen.queryByText(/Source-grounded therapy records\./)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Frequently used therapies" })).not.toBeInTheDocument();

    expect(await screen.findByRole("alert")).toHaveTextContent("Therapy mode could not load");
    expect(screen.queryByRole("heading", { name: "Therapy mode" })).not.toBeInTheDocument();

    failTherapies = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Therapy mode" })).toBeInTheDocument();
    expect(screen.getByText(/1 source-grounded therapy record\./)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("loads full therapy records only on a record-rich route", async () => {
    navigation.pathname = "/therapy-compass/test-therapy";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/therapies.json")) return response([therapy]);
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Detail ready</div>
      </TherapyCompassWorkspace>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/therapies\.json$/);
  });
});
