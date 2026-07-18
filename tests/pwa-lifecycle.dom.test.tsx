import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PwaLifecycle } from "@/components/pwa-lifecycle";

type MockWorker = ServiceWorker & { postMessage: ReturnType<typeof vi.fn> };

function createWorker(): MockWorker {
  const worker = new EventTarget() as MockWorker;
  Object.defineProperties(worker, {
    state: { configurable: true, value: "installed" },
    postMessage: { configurable: true, value: vi.fn() },
  });
  return worker;
}

function installServiceWorkerStub(waiting: ServiceWorker | null = null, controlled = Boolean(waiting)) {
  const registration = new EventTarget() as ServiceWorkerRegistration & {
    update: ReturnType<typeof vi.fn>;
  };
  Object.defineProperties(registration, {
    waiting: { configurable: true, value: waiting },
    installing: { configurable: true, value: null },
    update: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
  });

  const container = new EventTarget() as ServiceWorkerContainer & {
    register: ReturnType<typeof vi.fn>;
  };
  Object.defineProperties(container, {
    controller: { configurable: true, value: controlled ? {} : null },
    register: { configurable: true, value: vi.fn().mockResolvedValue(registration) },
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });

  return { container, registration };
}

function dispatchInstallEligibility(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  fireEvent(window, event);
  return prompt;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  delete document.documentElement.dataset.pwaDisplayMode;
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    value: vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    }),
  });
  Object.defineProperty(window, "cancelIdleCallback", { configurable: true, value: vi.fn() });
});

describe("PwaLifecycle", () => {
  it("does not register a worker in a normal non-production development session", async () => {
    const { container } = installServiceWorkerStub();
    render(<PwaLifecycle />);

    await Promise.resolve();
    expect(container.register).not.toHaveBeenCalled();
  });

  it("registers the root-scoped worker only through the explicit local PWA test opt-in", async () => {
    window.history.replaceState({}, "", "/?pwa-dev=1");
    const { container } = installServiceWorkerStub();
    render(<PwaLifecycle />);

    await waitFor(() =>
      expect(container.register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }),
    );
  });

  it("tears down the locally registered worker and owned caches via the explicit ?pwa-dev=0 opt-out", async () => {
    window.history.replaceState({}, "", "/?pwa-dev=0");
    const { container } = installServiceWorkerStub();

    const makeRegistration = (scriptURL: string) => {
      const registration = new EventTarget() as ServiceWorkerRegistration & { unregister: ReturnType<typeof vi.fn> };
      Object.defineProperties(registration, {
        active: { configurable: true, value: { scriptURL } },
        waiting: { configurable: true, value: null },
        installing: { configurable: true, value: null },
        unregister: { configurable: true, value: vi.fn().mockResolvedValue(true) },
      });
      return registration;
    };
    const ownRegistration = makeRegistration(new URL("/sw.js", window.location.origin).href);
    // Nested path ending in /sw.js: proves teardown exact-matches the owned
    // worker URL instead of suffix-matching.
    const foreignRegistration = makeRegistration(new URL("/other-app/sw.js", window.location.origin).href);
    Object.defineProperty(container, "getRegistrations", {
      configurable: true,
      value: vi.fn().mockResolvedValue([ownRegistration, foreignRegistration]),
    });

    const cacheDelete = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        delete: cacheDelete,
        keys: vi.fn().mockResolvedValue(["clinical-kb-pwa-shell-2026-07-15-v1", "unrelated-cache"]),
      } as unknown as CacheStorage,
    });

    render(<PwaLifecycle />);

    await waitFor(() => expect(ownRegistration.unregister).toHaveBeenCalledTimes(1));
    expect(foreignRegistration.unregister).not.toHaveBeenCalled();
    await waitFor(() => expect(cacheDelete).toHaveBeenCalledWith("clinical-kb-pwa-shell-2026-07-15-v1"));
    expect(cacheDelete).not.toHaveBeenCalledWith("unrelated-cache");
    expect(container.register).not.toHaveBeenCalled();
  });

  it("announces lost and restored connectivity without claiming private data is available offline", async () => {
    render(<PwaLifecycle />);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent.offline(window);
    expect(await screen.findByRole("region", { name: "You appear to be offline" })).toBeInTheDocument();
    expect(
      screen.getByText(/clinical search, answers, private documents, uploads, and account data require a connection/i),
    ).toBeInTheDocument();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent.online(window);
    expect(await screen.findByText("Connection restored")).toBeInTheDocument();
  });

  it("shows install UI only after browser eligibility and invokes the deferred prompt from a user action", async () => {
    const user = userEvent.setup();
    render(<PwaLifecycle />);

    expect(screen.queryByRole("region", { name: "Install Clinical KB" })).not.toBeInTheDocument();
    const prompt = dispatchInstallEligibility();
    const installRegion = await screen.findByRole("region", { name: "Install Clinical KB" });
    expect(installRegion).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Install app" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(installRegion).not.toBeInTheDocument());
  });

  it("requires a user decision before activating a waiting update", async () => {
    window.history.replaceState({}, "", "/?pwa-dev=1");
    const waitingWorker = createWorker();
    installServiceWorkerStub(waitingWorker);
    const user = userEvent.setup();
    render(<PwaLifecycle />);

    expect(await screen.findByText("An update is ready")).toBeInTheDocument();
    dispatchInstallEligibility();
    expect(screen.queryByRole("region", { name: "Install Clinical KB" })).not.toBeInTheDocument();
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Refresh now" }));
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("offers a refresh when another tab activates an update instead of silently leaving stale UI", async () => {
    window.history.replaceState({}, "", "/?pwa-dev=1");
    const { container } = installServiceWorkerStub(null, true);
    render(<PwaLifecycle />);

    await waitFor(() => expect(container.register).toHaveBeenCalled());
    act(() => {
      container.dispatchEvent(new Event("controllerchange"));
    });

    expect(await screen.findByRole("region", { name: "An update is ready" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
  });

  it("does not misreport the first controller claim as an application update", async () => {
    window.history.replaceState({}, "", "/?pwa-dev=1");
    const { container } = installServiceWorkerStub();
    render(<PwaLifecycle />);

    await waitFor(() => expect(container.register).toHaveBeenCalled());
    act(() => {
      container.dispatchEvent(new Event("controllerchange"));
    });

    expect(screen.queryByRole("region", { name: "An update is ready" })).not.toBeInTheDocument();
  });

  it("shows the one-time iOS Add to Home Screen hint and honours its dismissal window", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    try {
      const user = userEvent.setup();
      const { unmount } = render(<PwaLifecycle />);

      const hint = await screen.findByRole("region", { name: "Install Clinical KB" });
      expect(hint).toHaveTextContent(/tap Share, then Add to Home Screen/i);
      expect(hint).toHaveTextContent(/still require a connection/i);

      await user.click(screen.getByRole("button", { name: "Not now" }));
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Install Clinical KB" })).not.toBeInTheDocument(),
      );
      expect(Number(window.localStorage.getItem("clinical-kb-pwa-ios-install-dismissed-at"))).toBeGreaterThan(0);

      unmount();
      render(<PwaLifecycle />);
      expect(screen.queryByRole("region", { name: "Install Clinical KB" })).not.toBeInTheDocument();
    } finally {
      delete (navigator as { userAgent?: string }).userAgent;
    }
  });
});
