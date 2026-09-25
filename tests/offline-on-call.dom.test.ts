// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The offline page's On Call essentials, run for real: the page's own markup and
 * its one inline script, against the cached copy the app writes
 * (src/lib/on-call/entry-store.ts).
 */

const html = readFileSync(join(process.cwd(), "public", "offline.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
const body = html.match(/<body>([\s\S]*?)<script>/)![1];

const NOW = new Date("2026-09-25T12:00:00Z");
const CACHE_KEY = "clinical-kb-on-call-entries-cache";

function entry(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    section: "contacts",
    slug: "x",
    title: "Registrar",
    subtitle: null,
    body: null,
    details: { role: "On-call registrar", phone: "0400 111 222" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

function save(entries: unknown[], savedAt = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, savedAt }));
}

function run() {
  document.body.innerHTML = body;
  new Function(script)();
  return document.getElementById("on-call-offline")!;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("offline On Call essentials", () => {
  it("stays hidden when nothing is saved", () => {
    expect(run().hidden).toBe(true);
  });

  it("puts switchboard first, then pocket-card numbers, with tap-to-call and the saved time", () => {
    save([
      entry({ title: "Ward 5", sortOrder: 1, details: { role: "Nurse in charge", phone: "9224 0001" } }),
      entry({
        title: "Consultant",
        includeOnCard: true,
        sortOrder: 3,
        details: { role: "Consultant", phone: "0411 000 000", afterHoursPhone: "0422 000 000" },
      }),
      entry({ title: "Main switchboard", sortOrder: 9, details: { role: "Switchboard", phone: "(08) 9224 2244" } }),
    ]);
    const section = run();
    expect(section.hidden).toBe(false);
    const names = [...section.querySelectorAll('[data-testid="on-call-offline-contacts"] .name')].map(
      (n) => n.textContent,
    );
    expect(names).toEqual(["Main switchboard", "Consultant", "Ward 5"]);
    const calls = [...section.querySelectorAll("a.call")].map((a) => a.getAttribute("href"));
    expect(calls.slice(0, 3)).toEqual(["tel:0892242244", "tel:0411000000", "tel:0422000000"]);
    expect(document.getElementById("on-call-offline-saved")!.textContent).toMatch(
      /^Saved copy from .+ Numbers may have changed since\. If one does not work, call switchboard\.$/,
    );
  });

  it("shows escalation steps in order, with when each applies", () => {
    save([
      entry({
        section: "playbook",
        title: "Aggression on the ward",
        details: {
          trigger: "Aggression",
          escalationSteps: [
            { order: 2, whoToCall: "Consultant", when: "If not settling", phone: "0411 000 000", hours: "after-hours" },
            { order: 1, whoToCall: "Security", when: "Immediately", phone: "55555" },
          ],
        },
      }),
    ]);
    const steps = [...run().querySelectorAll('[data-testid="on-call-offline-ladder"] li')].map((li) => li.textContent);
    expect(steps[0]).toContain("1. Security");
    expect(steps[1]).toContain("2. Consultant");
    expect(steps[1]).toContain("after hours");
  });

  it("never shows personal entries or role explainers", () => {
    save([
      entry({ title: "My partner", isPersonal: true }),
      entry({ title: "What a registrar does", details: { role: "Registrar", kind: "role-explainer" } }),
    ]);
    expect(run().hidden).toBe(true);
  });

  it("shows nothing for a copy seven days old, a future-dated copy, a demo preview or corrupt data", () => {
    save([entry({})], new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
    expect(run().hidden).toBe(true);

    save([entry({})], new Date(NOW.getTime() + 60_000).toISOString());
    expect(run().hidden).toBe(true);

    save([entry({})]);
    window.localStorage.setItem("clinical-kb-on-call-demo-preview", "1");
    expect(run().hidden).toBe(true);

    window.localStorage.clear();
    window.localStorage.setItem(CACHE_KEY, "{not json");
    expect(run().hidden).toBe(true);
  });

  it("leaves off any entry never checked or not checked within 12 months, like the pocket card", () => {
    save([
      entry({ title: "Never checked", lastVerifiedAt: null }),
      entry({ title: "Checked 13 months ago", lastVerifiedAt: "2025-08-20T00:00:00Z" }),
      entry({ title: "Unreadable date", lastVerifiedAt: "not a date" }),
      entry({ title: "Checked in March", lastVerifiedAt: "2026-03-01T00:00:00Z" }),
    ]);
    const names = [...run().querySelectorAll(".name")].map((n) => n.textContent);
    expect(names).toEqual(["Checked in March"]);
    expect(document.querySelector('[data-testid="on-call-offline-contacts"] .meta')!.textContent).toContain(
      "checked Mar 2026",
    );
  });

  it("uses the same limits as the app: seven days for the saved copy, twelve months for a check", () => {
    const store = readFileSync(join(process.cwd(), "src/lib/on-call/entry-store.ts"), "utf8");
    const model = readFileSync(join(process.cwd(), "src/lib/on-call/entry-model.ts"), "utf8");
    expect(store).toContain("ON_CALL_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;");
    expect(script).toContain("var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;");
    expect(model).toContain("ON_CALL_REVIEW_INTERVAL_MONTHS = 12;");
    expect(script).toContain("var REVIEW_INTERVAL_MONTHS = 12;");
  });

  it("treats saved text as text, never markup, and drops a call link with no real number", () => {
    save([entry({ title: '<img src=x onerror="alert(1)">', details: { role: "Test", phone: "call me" } })]);
    const section = run();
    expect(section.querySelector("img")).toBeNull();
    expect(section.querySelector(".name")!.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(section.querySelector("a.call")).toBeNull();
  });

  it("only reads storage: it writes and removes nothing", () => {
    save([entry({})]);
    const before = JSON.stringify({ ...window.localStorage });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    run();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...window.localStorage })).toBe(before);
  });
});
