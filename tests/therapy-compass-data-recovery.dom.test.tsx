import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyCompassWorkspace } from "@/components/therapy-compass";
import { useTcBindings } from "@/components/therapy-compass/bindings";
import { clearTherapyDataCache } from "@/components/therapy-compass/data/use-therapy-data";
import {
  THERAPY_CATALOGUE_ASSETS,
  THERAPY_CATALOGUE_SUMMARY,
} from "@/components/therapy-compass/data/generated-assets";
import { HomeScreen } from "@/components/therapy-compass/screens/home-screen";

const navigation = vi.hoisted(() => ({ pathname: "/therapy-compass", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), prefetch: vi.fn() }),
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

function RichRouteProbe({ readyLabel }: { readyLabel: string }) {
  const bindings = useTcBindings();
  return bindings.loading ? <div role="status">Loading Therapy…</div> : <div>{readyLabel}</div>;
}

afterEach(() => {
  navigation.pathname = "/therapy-compass";
  navigation.push.mockReset();
  clearTherapyDataCache();
  vi.unstubAllGlobals();
});

describe("Therapy Compass required data recovery", () => {
  it("paints the generated catalogue count without fetching a home projection", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Therapy" })).toBeInTheDocument();
    expect(
      screen.getByText(`${THERAPY_CATALOGUE_SUMMARY.totalCount} source-grounded therapy records.`),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());

    expect(screen.getByRole("link", { name: /Compare therapies/i })).toHaveAttribute(
      "href",
      "/therapy-compass/compare",
    );
  });

  it("shows an honest load error, retries all required files, and recovers", async () => {
    navigation.pathname = "/therapy-compass/test-therapy";
    let failTherapies = true;
    // The loader tries the content-addressed URL, then the unversioned alias
    // (a pre-deploy bundle can name a hash that no longer exists). Both must
    // fail before the tool is allowed to claim the catalogue could not load.
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.full}`) || path.endsWith("/therapies.json")) {
        return failTherapies ? response(null, false, 503) : response([therapy]);
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Detail ready</div>
      </TherapyCompassWorkspace>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Therapy could not load");
    expect(screen.queryByText("Detail ready")).not.toBeInTheDocument();

    failTherapies = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Detail ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Hashed + alias on the failing load, hashed only once it recovers.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining(`/${THERAPY_CATALOGUE_ASSETS.full}`),
      expect.stringContaining("/therapies.json"),
      expect.stringContaining(`/${THERAPY_CATALOGUE_ASSETS.full}`),
    ]);
  });

  it("keeps Retry busy until the replacement catalogue request settles", async () => {
    navigation.pathname = "/therapy-compass/test-therapy";
    let failTherapies = true;
    let releaseRetry!: (value: unknown) => void;
    const retryGate = new Promise((resolve) => {
      releaseRetry = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.full}`)) {
        if (failTherapies) return response(null, false, 503);
        await retryGate;
        return response([therapy]);
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Detail ready</div>
      </TherapyCompassWorkspace>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Therapy could not load");
    failTherapies = false;
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Detail ready")).not.toBeInTheDocument();

    releaseRetry(undefined);

    expect(await screen.findByText("Detail ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows current loading rather than a stale error after Home re-enables catalogue loading", async () => {
    navigation.pathname = "/therapy-compass/search";
    let recover = false;
    let releaseRecovery!: () => void;
    const recoveryGate = new Promise<void>((resolve) => {
      releaseRecovery = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.full}`)) {
        if (!recover) return response(null, false, 503);
        await recoveryGate;
        return response([therapy]);
      }
      if (path.endsWith("/therapies.json")) return response(null, false, 503);
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <TherapyCompassWorkspace>
        <RichRouteProbe readyLabel="Search ready" />
      </TherapyCompassWorkspace>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Therapy could not load");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    navigation.pathname = "/therapy-compass";
    view.rerender(
      <TherapyCompassWorkspace>
        <HomeScreen />
      </TherapyCompassWorkspace>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Therapy" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    recover = true;
    navigation.pathname = "/therapy-compass/recommend";
    view.rerender(
      <TherapyCompassWorkspace>
        <RichRouteProbe readyLabel="Recommend ready" />
      </TherapyCompassWorkspace>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading Therapy");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText("Recommend ready")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    releaseRecovery();

    expect(await screen.findByText("Recommend ready")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("loads full therapy records only on a record-rich route", async () => {
    navigation.pathname = "/therapy-compass/test-therapy";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.full}`)) return response([therapy]);
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Detail ready</div>
      </TherapyCompassWorkspace>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/${THERAPY_CATALOGUE_ASSETS.full}`);
  });

  it("keeps the full prose corpus on the search route", async () => {
    navigation.pathname = "/therapy-compass/search";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.full}`)) return response([therapy]);
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Search ready</div>
      </TherapyCompassWorkspace>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/${THERAPY_CATALOGUE_ASSETS.full}`);
  });

  it("keeps the compact browse index on the pathways route", async () => {
    navigation.pathname = "/therapy-compass/pathways";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith(`/${THERAPY_CATALOGUE_ASSETS.index}`)) return response([therapy]);
      if (path.endsWith("/pathways.json")) return response([]);
      throw new Error(`Unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapyCompassWorkspace>
        <div>Pathways ready</div>
      </TherapyCompassWorkspace>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const fetched = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(fetched.some((url) => url.endsWith(`/${THERAPY_CATALOGUE_ASSETS.index}`))).toBe(true);
    expect(fetched.some((url) => /\/pathways\.json$/.test(url))).toBe(true);
    expect(fetched.some((url) => url.includes(`/${THERAPY_CATALOGUE_ASSETS.full}`))).toBe(false);
  });
});
