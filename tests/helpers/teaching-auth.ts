import { vi } from "vitest";

/**
 * A mutable stand-in for `useAuthSession`, shared by every Teaching DOM test:
 * `vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));`
 * `useTeachingTestClock` resets it before each test.
 */
export const authState = {
  status: "authenticated" as "authenticated" | "signed_out" | "loading",
  authEpoch: 1,
  signInWithEmail: vi.fn(async () => undefined),
};

export function useAuthSession() {
  return authState;
}
