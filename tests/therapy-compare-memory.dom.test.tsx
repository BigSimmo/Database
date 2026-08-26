import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";
import {
  resetTherapyCompareMemoryForTests,
  therapyCompareMemoryStorageKey,
  writeTherapyCompareMemory,
} from "@/lib/therapy-compare-memory";

const navState = vi.hoisted(() => ({
  pathname: "/therapy-compass/search",
  search: "q=trauma&run=1",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
  useRouter: () => ({ push: navState.push, replace: navState.replace, prefetch: () => {} }),
}));

function therapy(slug: string) {
  return {
    slug,
    name: slug.toUpperCase(),
    category: "Standard Talking Therapies",
    tags: [],
    aliases: [],
    warnings: [],
    sources: [],
    patientSheetTemplates: [],
    clinicianScripts: [],
    reviewChecklist: null,
    reviewStatus: "needs_review",
    patientSheetAvailable: false,
    briefInterventionAvailable: false,
  };
}

const CATALOGUE = [therapy("cbt"), therapy("act"), therapy("emdr")];

function stubCatalogue(therapies: unknown[] = CATALOGUE) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const body = String(url).includes("pathways") || String(url).includes("reference") ? [] : therapies;
      return Promise.resolve({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) });
    }),
  );
}

function CompareProbe() {
  const b = useTcBindings();
  return <div data-testid="set">{b.compareSlugs.join(",")}</div>;
}

function renderProvider() {
  return render(
    <TcProvider>
      <CompareProbe />
    </TcProvider>,
  );
}

/** The `ids` the provider asked the router to write, if any. */
function replacedIds(): string | null {
  for (const call of navState.replace.mock.calls) {
    const href = String(call[0]);
    const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    const ids = new URLSearchParams(query).get("ids");
    if (ids) return ids;
  }
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  resetTherapyCompareMemoryForTests();
  navState.pathname = "/therapy-compass/search";
  navState.search = "q=trauma&run=1";
});

afterEach(() => {
  vi.unstubAllGlobals();
  navState.push.mockReset();
  navState.replace.mockReset();
});

describe("Therapy compare set — device memory", () => {
  it("restores the remembered set when the URL carries no ids", async () => {
    writeTherapyCompareMemory(["cbt", "act"]);
    stubCatalogue();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("set")).toHaveTextContent("cbt,act"));
    expect(replacedIds()).toBe("cbt,act");
  });

  it("lets a shared link win over whatever this device remembers", async () => {
    writeTherapyCompareMemory(["cbt", "act"]);
    navState.search = "q=trauma&run=1&ids=emdr";
    stubCatalogue();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("set")).toHaveTextContent("emdr"));
    // Nothing may rewrite `ids` away from what the link asked for.
    expect(replacedIds() === null || replacedIds() === "emdr").toBe(true);
    expect(screen.getByTestId("set")).not.toHaveTextContent("cbt");
  });

  it("drops a remembered slug that is no longer in the catalogue", async () => {
    writeTherapyCompareMemory(["cbt", "retired-therapy"]);
    stubCatalogue();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("set")).toHaveTextContent("cbt"));
    expect(screen.getByTestId("set")).not.toHaveTextContent("retired-therapy");
  });

  it("restores nothing when no remembered slug survives catalogue validation", async () => {
    writeTherapyCompareMemory(["retired-one", "retired-two"]);
    stubCatalogue();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("set")).toBeInTheDocument());
    expect(screen.getByTestId("set")).toHaveTextContent("");
    expect(replacedIds()).toBeNull();
  });

  it("does not restore before the catalogue has loaded", () => {
    writeTherapyCompareMemory(["cbt", "act"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderProvider();

    expect(screen.getByTestId("set")).toHaveTextContent("");
    expect(replacedIds()).toBeNull();
  });

  it("mirrors the live set into storage once the restore has decided", async () => {
    navState.search = "q=trauma&run=1&ids=emdr";
    stubCatalogue();
    renderProvider();

    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(therapyCompareMemoryStorageKey) ?? "null")).toEqual(["emdr"]),
    );
  });

  it("never writes storage before the restore has decided", () => {
    writeTherapyCompareMemory(["cbt", "act"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderProvider();

    // The remembered set must survive a mount that never finished loading —
    // writing the empty starting set here is what would silently destroy it.
    expect(JSON.parse(window.localStorage.getItem(therapyCompareMemoryStorageKey) ?? "null")).toEqual(["cbt", "act"]);
  });
});
