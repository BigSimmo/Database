// tests/settings-open-param.dom.test.tsx
//
// `/settings` used to 404. Settings is a dialog held in React state with no address of its own,
// so a bookmark, a support instruction ("open Settings and turn X off") or a typed URL got a
// not-found page (2026-09-17 audit, finding L3).
//
// Redirecting `/settings` to the home page alone would have been a 404 with extra steps -- the
// person arrives somewhere that looks fine and still has to find what they came for. So the
// redirect targets `/?settings=open`, and this is the half that makes that address mean anything.
import { act, cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  SettingsStateProvider,
  useSettingsState,
  __resetSettingsParamForTests,
} from "@/components/clinical-dashboard/SettingsStateProvider";

function Probe() {
  const { settingsOpen } = useSettingsState();
  return <span data-testid="state">{settingsOpen ? "open" : "closed"}</span>;
}

function renderAt(url: string) {
  window.history.replaceState({}, "", url);
  // The parameter is read once per page load and latched, so each case must start from a fresh
  // latch the way a real navigation would.
  __resetSettingsParamForTests();
  return render(
    <SettingsStateProvider>
      <Probe />
    </SettingsStateProvider>,
  );
}

const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  __resetSettingsParamForTests();
});

describe("the settings query parameter", () => {
  it("opens settings when the redirect lands", async () => {
    await act(async () => {
      renderAt("/?settings=open");
    });
    expect(state()).toBe("open");
  });

  it("strips itself once consumed", async () => {
    // Otherwise closing the dialog and reloading silently re-opens it, and the parameter travels
    // into any URL the person copies or bookmarks as if it were part of the page's identity.
    await act(async () => {
      renderAt("/?settings=open");
    });
    expect(window.location.search).toBe("");
  });

  it("keeps the rest of the query string", async () => {
    await act(async () => {
      renderAt("/?mode=documents&settings=open&q=lithium");
    });
    expect(state()).toBe("open");
    expect(window.location.search).toBe("?mode=documents&q=lithium");
  });

  it("leaves settings closed without it, and on another value", async () => {
    // The guard against a parameter that opens on anything: `?settings=1` from some other source
    // must not throw a dialog over the page.
    for (const url of ["/", "/?mode=answer", "/?settings=", "/?settings=1", "/?settings=closed"]) {
      cleanup();
      await act(async () => {
        renderAt(url);
      });
      expect(state(), `expected settings closed at ${url}`).toBe("closed");
    }
  });

  it("does not rewrite the URL when it is not there", async () => {
    await act(async () => {
      renderAt("/?mode=documents&q=lithium");
    });
    expect(window.location.search).toBe("?mode=documents&q=lithium");
  });
});
