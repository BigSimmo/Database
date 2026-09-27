import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: vi.fn(), send: vi.fn(), configured: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/roster/alerts/recipients", () => ({ activeRecipientIds: mocks.active }));
vi.mock("@/lib/roster/alerts/send", () => ({ sendRosterAlerts: mocks.send, webPushConfigured: mocks.configured }));
import { sendMakerPublicationAlerts } from "@/lib/roster/maker/publication-alerts";
import type { RosterAdminClient } from "@/lib/roster/team/api";
const receipt = {
  publicationId: "publication",
  version: 2,
  draftVersion: 3,
  changedUserIds: ["doctor", "former"],
  swapsCancelled: [],
  replayed: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.active.mockResolvedValue(new Set(["doctor"]));
  mocks.send.mockResolvedValue({ sent: 1, skipped: 0, failed: 0 });
});
it("sends a generic alert only to active recipients from the receipt", async () => {
  const result = await sendMakerPublicationAlerts({} as RosterAdminClient, "manager", "team", receipt);
  expect(mocks.send).toHaveBeenCalledWith({}, ["doctor"], "changed");
  expect(result).toEqual({ status: "processed", sent: 1, skipped: 1, failed: 0 });
});
it("does not resend when publication is replayed", async () => {
  expect(
    (await sendMakerPublicationAlerts({} as RosterAdminClient, "manager", "team", { ...receipt, replayed: true }))
      .status,
  ).toBe("not_retried");
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.active).not.toHaveBeenCalled();
});
it("retains successful delivery counts when a later batch fails", async () => {
  const people = Array.from({ length: 501 }, (_, index) => `doctor-${index}`);
  mocks.active.mockResolvedValue(new Set(people));
  mocks.send
    .mockResolvedValueOnce({ sent: 500, skipped: 0, failed: 0 })
    .mockRejectedValueOnce(new Error("delivery unavailable"));
  const result = await sendMakerPublicationAlerts({} as RosterAdminClient, "manager", "team", {
    ...receipt,
    changedUserIds: people,
  });
  expect(result).toEqual({ status: "partial", sent: 500, skipped: 0, failed: 1 });
});
