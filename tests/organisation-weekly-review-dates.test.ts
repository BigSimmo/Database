import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectReviewDates, DUE_WITHIN_DAYS, section } from "../scripts/organisation/weekly/review-dates.mjs";
import { latestIsoDate, perthMidday, shiftIsoDate } from "./helpers/fixed-clock";

// Organisation framework suggestion 6, "defuse the date traps": the weekly section that raises
// lapsed or soon-lapsing governance review dates, now that an unrelated pull request only warns.

const HAZARD = "docs/clinical-hazard-controls.json";
const PRIVACY = "docs/governance/privacy-readiness.v1.json";
const TODAY = "2026-10-10";
const NOW = perthMidday(TODAY);
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function tempRoot(files: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-review-dates-"));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}

const far = shiftIsoDate(TODAY, 200);
const hazardRegister = (overrides: Record<string, unknown> = {}) => ({
  reviewExpiresAt: far,
  hazards: [
    { id: "H1", owner: "Clinical safety owner", reviewExpiresAt: shiftIsoDate(TODAY, -3) },
    { id: "H2", owner: "Answer quality owner", reviewExpiresAt: shiftIsoDate(TODAY, DUE_WITHIN_DAYS) },
    { id: "H3", owner: "Clinical UX owner", reviewExpiresAt: shiftIsoDate(TODAY, DUE_WITHIN_DAYS + 1) },
  ],
  assuranceDecisions: [{ id: "D1", owner: "Clinical governance authority", reviewExpiresAt: far }],
  driftExceptions: [{ path: "src/lib/example.ts", expiresOn: shiftIsoDate(TODAY, -1) }],
  ...overrides,
});
const privacyRegister = (overrides: Record<string, unknown> = {}) => ({
  reviewExpiresAt: far,
  requirements: [
    { id: "PRIV-A", accountableRole: "Privacy adviser", reviewExpiresAt: TODAY },
    { id: "PRIV-B", accountableRole: "Production platform owner", reviewExpiresAt: far },
  ],
  ...overrides,
});

describe("which review dates the weekly section flags", () => {
  it("flags lapsed entries and entries whose last valid day is within 14 days, and leaves later ones out", async () => {
    const root = tempRoot({ [HAZARD]: hazardRegister(), [PRIVACY]: privacyRegister() });
    const { title, markdown } = await section({ root, now: NOW });
    expect(title).toBe("Review dates");
    expect(markdown).toContain(
      `As of ${TODAY} (Perth): 2 lapsed and 2 due for re-review within 14 days, out of 9 dated entries`,
    );
    expect(markdown).toContain(
      `**Lapsed 2 days ago (last valid day ${shiftIsoDate(TODAY, -3)}):** H1 (Clinical safety owner).`,
    );
    expect(markdown).toContain(
      `**Lapsed today (last valid day ${shiftIsoDate(TODAY, -1)}):** the drift exception for \`src/lib/example.ts\`.`,
    );
    expect(markdown).toContain(
      `**Lapses in 15 days (last valid day ${shiftIsoDate(TODAY, DUE_WITHIN_DAYS)}):** H2 (Answer quality owner).`,
    );
    expect(markdown).toContain(`**Lapses tomorrow (last valid day ${TODAY}):** PRIV-A (Privacy adviser).`);
    for (const later of ["H3", "D1", "PRIV-B", "the register-wide review"]) expect(markdown).not.toContain(later);
  });

  it("judges the date in Perth, where a review lapses the day after its last valid day", () => {
    const root = tempRoot({ [HAZARD]: hazardRegister({ hazards: [] }), [PRIVACY]: privacyRegister() });
    const row = (now: Date) =>
      collectReviewDates({ root, now }).registers[1].rows.find((item: { label: string }) => item.label === "PRIV-A");
    // 15:59:59 UTC is still TODAY in Perth (UTC+8); 16:00 UTC is the next day there.
    expect(row(new Date(`${TODAY}T15:59:59Z`))?.status.lapsed).toBe(false);
    expect(row(new Date(`${TODAY}T16:00:00Z`))?.status.lapsed).toBe(true);
  });

  it("treats an unreadable date as lapsed, never as current", async () => {
    const root = tempRoot({
      [HAZARD]: hazardRegister({ hazards: [{ id: "H9", owner: "Owner", reviewExpiresAt: "2026-02-30" }] }),
      [PRIVACY]: privacyRegister({ requirements: [{ id: "PRIV-C", accountableRole: "Role" }] }),
    });
    const { markdown } = await section({ root, now: NOW });
    expect(markdown).toContain("**Date unreadable (treated as lapsed):** H9 (Owner).");
    expect(markdown).toContain("**Date unreadable (treated as lapsed):** PRIV-C (Role).");
  });

  it("says so plainly when nothing needs attention", async () => {
    const root = tempRoot({
      [HAZARD]: hazardRegister({ hazards: [], driftExceptions: [] }),
      [PRIVACY]: privacyRegister({ requirements: [] }),
    });
    const { markdown } = await section({ root, now: NOW });
    expect(markdown).toBe(
      `As of ${TODAY} (Perth), none of the 3 dated entries in the clinical hazard and privacy readiness registers ` +
        "has lapsed or falls due within 14 days.\n",
    );
  });
});

describe("what the weekly section explains", () => {
  it("says what re-review means for each kind of entry it lists, and nothing for kinds it does not", async () => {
    const root = tempRoot({ [HAZARD]: hazardRegister(), [PRIVACY]: privacyRegister() });
    const { markdown } = await section({ root, now: NOW });
    expect(markdown).toContain("re-checks the entry's controls, tests and residual risk");
    expect(markdown).toContain("`npm run governance:seal-hazard-controls`");
    expect(markdown).toContain("Recording a new exception without that review is not a re-review.");
    expect(markdown).toContain("the accountable role re-checks the evidence");
    expect(markdown).toContain("A lapsed date still fails each register's own check in local runs, on main");

    const hazardOnly = tempRoot({
      [HAZARD]: hazardRegister({ driftExceptions: [] }),
      [PRIVACY]: privacyRegister({ requirements: [] }),
    });
    const quiet = (await section({ root: hazardOnly, now: NOW })).markdown;
    expect(quiet).not.toContain("drift exception excuses");
    expect(quiet).not.toContain("accountable role");
  });

  it("reports a missing or broken register without leaking a local path, and never throws for it", async () => {
    const root = tempRoot({ [PRIVACY]: "{ not json" });
    const { markdown } = await section({ root, now: NOW });
    expect(markdown).toContain(
      `**Clinical hazard register** (\`${HAZARD}\`): not checked, because the file is missing.`,
    );
    expect(markdown).toContain(
      `**Privacy readiness register** (\`${PRIVACY}\`): not checked, because it is not valid JSON.`,
    );
    expect(markdown).not.toContain(root);
    expect(markdown).not.toContain(os.tmpdir());
  });

  it("needs an explicit, valid now", async () => {
    const root = tempRoot({ [HAZARD]: hazardRegister(), [PRIVACY]: privacyRegister() });
    await expect(section({ root, now: undefined as unknown as Date })).rejects.toThrow(TypeError);
    await expect(section({ root, now: "not a date" })).rejects.toThrow(TypeError);
  });
});

describe("the committed registers", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
  const hazard = read(HAZARD);
  const privacy = read(PRIVACY);
  const expiries = [
    hazard.reviewExpiresAt,
    ...[...hazard.hazards, ...hazard.assuranceDecisions].map(
      (entry: { reviewExpiresAt: string }) => entry.reviewExpiresAt,
    ),
    ...(hazard.driftExceptions ?? []).map((exception: { expiresOn: string }) => exception.expiresOn),
    privacy.reviewExpiresAt,
    ...privacy.requirements.map((item: { reviewExpiresAt: string }) => item.reviewExpiresAt),
  ];

  it("lists every dated entry of both registers once all of them have lapsed", async () => {
    // Derived from the registers, never the real clock, so this cannot turn red on a date.
    const now = perthMidday(shiftIsoDate(latestIsoDate(expiries), 1));
    const { markdown } = await section({ root: repoRoot, now });
    expect(markdown).toContain(`${expiries.length} lapsed and 0 due for re-review within 14 days`);
    for (const entry of [...hazard.hazards, ...hazard.assuranceDecisions, ...privacy.requirements]) {
      expect(markdown).toContain(entry.id);
    }
    for (const exception of hazard.driftExceptions ?? []) expect(markdown).toContain(`\`${exception.path}\``);
  });
});
