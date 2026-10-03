import { describe, expect, it } from "vitest";

import {
  loadSignOffQueue,
  type SignOffFamily,
  type SignOffQueue,
  type SignOffRow,
} from "@/lib/developer-area/sign-off-queue";
import {
  SIGN_OFF_TODAY_FAMILY_ORDER,
  SIGN_OFF_TODAY_SIZE,
  pickSignOffToday,
  signOffCommand,
  signOffMyDayItem,
} from "@/lib/developer-area/sign-off-today";

function row(family: SignOffRow["family"], id: string, signable: boolean): SignOffRow {
  return {
    family,
    key: `${family}:${id}`,
    id,
    title: `Title ${id}`,
    nativeStatus: "drafted",
    statusLabel: "Drafted",
    requires: "A named reviewer signs it.",
    href: null,
    signOff: signable ? { script: "clinical:review", kind: "form", code: id } : null,
  };
}

function family(id: SignOffFamily["id"], rows: SignOffRow[]): SignOffFamily {
  return { id, name: `Family ${id}`, source: "x", nativeField: "status", note: "", unrouted: false, rows };
}

function queue(families: SignOffFamily[]): SignOffQueue {
  return { families, total: families.reduce((sum, item) => sum + item.rows.length, 0) };
}

describe("pickSignOffToday", () => {
  it("takes signable rows in the fixed family order, not the queue's order", () => {
    const today = pickSignOffToday(
      queue([
        family("therapy", [row("therapy", "t1", true)]),
        family("wa-mha-forms", [row("wa-mha-forms", "3C", true), row("wa-mha-forms", "4A", true)]),
      ]),
    );
    expect(today.rows.map((item) => item.id)).toEqual(["3C", "4A", "t1"]);
  });

  it("skips rows no tool can sign, and families outside the order", () => {
    const today = pickSignOffToday(
      queue([
        family("wa-mha-forms", [row("wa-mha-forms", "1A", false), row("wa-mha-forms", "1B", true)]),
        family("specifiers", [row("specifiers", "s1", true)]),
      ]),
    );
    expect(today.rows.map((item) => item.id)).toEqual(["1B"]);
    expect(today.waiting).toBe(3);
    expect(today.signable).toBe(1);
  });

  it("caps the list at the requested size but counts every signable row", () => {
    const rows = Array.from({ length: 12 }, (_, index) => row("wa-mha-forms", `F${index}`, true));
    const today = pickSignOffToday(queue([family("wa-mha-forms", rows)]));
    expect(today.rows).toHaveLength(SIGN_OFF_TODAY_SIZE);
    expect(today.signable).toBe(12);
    expect(pickSignOffToday(queue([family("wa-mha-forms", rows)]), 0).rows).toEqual([]);
  });
});

describe("signOffCommand", () => {
  it("builds the clinical:review command with a placeholder reviewer", () => {
    expect(signOffCommand({ script: "clinical:review", kind: "form", code: "3C" })).toBe(
      'npm run clinical:review -- --write --kind form --code 3C --reviewed-by "<your public name>"',
    );
  });

  it("builds the therapy:review command by slug", () => {
    expect(signOffCommand({ script: "therapy:review", slug: "dbt" })).toBe(
      'npm run therapy:review -- --write --slug dbt --reviewed-by "<your public name>"',
    );
  });
});

describe("signOffMyDayItem", () => {
  it("is one count line linking to the owner panel, never record titles", () => {
    const today = pickSignOffToday(queue([family("wa-mha-forms", [row("wa-mha-forms", "3C", true)])]));
    const item = signOffMyDayItem(today);
    expect(item).toMatchObject({ id: "sign-off:today", severity: "info", due: null });
    expect(item?.title).toBe("1 clinical record to sign off today");
    expect(item?.title).not.toContain("Title 3C");
    expect(item?.href.startsWith("/mockups/development")).toBe(true);
  });

  it("is absent when nothing can be signed", () => {
    expect(signOffMyDayItem(pickSignOffToday(queue([])))).toBeNull();
  });
});

describe("the real queue", () => {
  const real = loadSignOffQueue();
  const today = pickSignOffToday(real);

  it("offers a command for every row it lists, and only from ordered families", () => {
    expect(today.rows.length).toBeGreaterThan(0);
    for (const item of today.rows) {
      expect(SIGN_OFF_TODAY_FAMILY_ORDER).toContain(item.family);
      expect(item.command).toContain("--write");
      expect(item.command).toContain("<your public name>");
    }
  });

  it("never offers a command for records with no sign-off tool", () => {
    const unsignable = real.families.flatMap((item) => item.rows).filter((item) => item.signOff === null);
    const keys = new Set(today.rows.map((item) => item.key));
    for (const item of unsignable) expect(keys.has(item.key)).toBe(false);
    // The exported differential records and the dictionary sense drafts have no tool.
    expect(unsignable.some((item) => item.key.startsWith("dictionary-sense:"))).toBe(true);
    expect(unsignable.some((item) => item.key.startsWith("differential-presentation:"))).toBe(true);
  });

  it("names the form code the sign-off tool expects", () => {
    const forms = real.families.find((item) => item.id === "wa-mha-forms")!;
    for (const form of forms.rows) {
      expect(form.signOff).toMatchObject({ script: "clinical:review", kind: "form" });
      expect(form.title).toContain(`Form ${(form.signOff as { code: string }).code} `);
    }
  });
});
