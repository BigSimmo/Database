import { describe, expect, it } from "vitest";

import { dragTargetIndex, moveEntry } from "@/components/favourites/favourites-view-model";
import { planFavouriteItemOrder } from "@/lib/favourites-order";

const row = (contentKey: string, sortOrder: number) => ({ contentType: "service", contentKey, sortOrder });
const ref = (contentKey: string) => ({ contentType: "service", contentKey });

describe("exact favourite order", () => {
  it("writes (index + 1) * 10 and skips rows already in place", () => {
    const plan = planFavouriteItemOrder([row("a", 10), row("b", 20), row("c", 30)], [ref("c"), ref("b"), ref("a")]);
    expect(plan).toEqual({ ok: true, updates: [row("c", 10), row("a", 30)] });
  });

  it("refuses a stale order that drops, adds or repeats a member", () => {
    const current = [row("a", 10), row("b", 20)];
    expect(planFavouriteItemOrder(current, [ref("a")])).toEqual({ ok: false });
    expect(planFavouriteItemOrder(current, [ref("a"), ref("z")])).toEqual({ ok: false });
    expect(planFavouriteItemOrder(current, [ref("a"), ref("a")])).toEqual({ ok: false });
  });

  it("drops a dragged row where its centre lands", () => {
    const centers = [32, 96, 160, 224];
    expect(dragTargetIndex(centers, 0, 32)).toBe(0);
    expect(dragTargetIndex(centers, 0, 170)).toBe(2);
    expect(dragTargetIndex(centers, 3, 10)).toBe(0);
    expect(moveEntry(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveEntry(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
});
