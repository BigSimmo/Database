import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyCompassWorkspace } from "@/components/therapy-compass";
import { clearTherapyDataCache } from "@/components/therapy-compass/data/use-therapy-data";
import { HomeScreen } from "@/components/therapy-compass/screens/home-screen";

vi.mock("next/navigation", () => ({
  usePathname: () => "/therapy-compass",
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
      if (path.endsWith("/therapies.json")) {
        await therapiesGate;
        return response([therapy]);
      }
      if (path.endsWith("/pathways.json")) return response([]);
      if (path.endsWith("/reference.json")) return response({});
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(await screen.findByRole("heading", { name: "What therapy are you looking for?" })).toBeInTheDocument();
    expect(screen.getByText(/Search 200\+ source-grounded therapy records by/)).toBeInTheDocument();
    expect(screen.queryByText(/Search 0 source-grounded therapy/)).not.toBeInTheDocument();

    release(undefined);

    await waitFor(() =>
      expect(screen.getByText(/Search 1 source-grounded therapy records? by/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Search 1 source-grounded therapy records? by/)).toBeInTheDocument();
    expect(screen.queryByText(/Search 0 source-grounded therapy/)).not.toBeInTheDocument();
  });

  it("shows an honest load error, retries all required files, and recovers", async () => {
    let failTherapies = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/therapies.json")) {
        return failTherapies ? response(null, false, 503) : response([therapy]);
      }
      if (path.endsWith("/pathways.json")) return response([]);
      if (path.endsWith("/reference.json")) return response({});
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(screen.getByRole("heading", { name: "What therapy are you looking for?" })).toBeInTheDocument();
    expect(screen.getByText(/Search 200\+ source-grounded therapy records by/)).toBeInTheDocument();
    expect(screen.queryByText(/Search 0 source-grounded therapy records/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Frequently used therapies" })).not.toBeInTheDocument();

    expect(await screen.findByRole("alert")).toHaveTextContent("Therapy Compass could not load");
    expect(screen.queryByRole("heading", { name: "What therapy are you looking for?" })).not.toBeInTheDocument();

    failTherapies = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "What therapy are you looking for?" })).toBeInTheDocument();
    expect(screen.getByText(/Search 1 source-grounded therapy records? by/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });
});
