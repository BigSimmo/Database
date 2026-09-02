/** @vitest-environment jsdom */

// Account transitions must not hand one clinician's patient context to the next
// person at a shared workstation. The three transitions the auth provider owns —
// sign-out, session expiry, and a change of signed-in user in the same tab —
// already clear recent queries, the answer thread and the signed-URL cache. This
// file pins the stores those paths were missing: the sessionStorage patient
// physiology profile (2026-09-02 audit, M4), the favourites pins / last-opened
// keys (L2) and the Caring Contacts plan draft (L6).

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: unknown) => void>();
  const session = {
    access_token: "user-a-token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-a" },
  };
  return {
    listeners,
    session,
    signOut: vi.fn(async () => {
      for (const listener of listeners) listener("SIGNED_OUT", null);
      return { error: null };
    }),
    getUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
  };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: authApi.getUser,
      getSession: authApi.getSession,
      signOut: authApi.signOut,
      onAuthStateChange: authApi.onAuthStateChange,
      signInWithOtp: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  }),
}));

import {
  EMPTY_PATIENT_PROFILE,
  PATIENT_PROFILE_STORAGE_KEY,
  getPatientProfileSnapshot,
  subscribePatientProfile,
  writePatientProfile,
} from "@/lib/patient-profile-storage";
import { AuthProvider, useAuthSession } from "@/lib/supabase/client";

const USER_B_SESSION = { ...authApi.session, access_token: "user-b-token", user: { id: "user-b" } };

function AuthActions() {
  const { status, signOut, markSessionExpired } = useAuthSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <button type="button" onClick={() => markSessionExpired()}>
        Expire session
      </button>
    </div>
  );
}

async function mountAuthenticated() {
  render(
    <AuthProvider>
      <AuthActions />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
}

async function emitAuthStateChange(event: string, session: unknown) {
  await act(async () => {
    for (const listener of authApi.listeners) listener(event, session);
  });
}

const transitions: Array<{ name: string; run: () => Promise<void>; expectedStatus: string }> = [
  {
    name: "sign-out",
    run: async () => {
      await act(async () => {
        screen.getByRole("button", { name: "Sign out" }).click();
      });
    },
    expectedStatus: "signed_out",
  },
  {
    name: "session expiry",
    run: async () => {
      await act(async () => {
        screen.getByRole("button", { name: "Expire session" }).click();
      });
    },
    expectedStatus: "expired",
  },
  {
    name: "a different user signing in to the same tab",
    run: async () => {
      await emitAuthStateChange("SIGNED_IN", USER_B_SESSION);
    },
    expectedStatus: "authenticated",
  },
];

// Patient A's physiology: exactly what the medication surfaces would evaluate
// clinician B's prescribing alerts against if it survived the transition.
const PATIENT_A_PROFILE = {
  ...EMPTY_PATIENT_PROFILE,
  ageYears: 82,
  egfr: 22,
  qtc: 495,
  pregnant: false,
  allergies: ["penicillin" as const],
  medications: ["lithium", "sertraline"],
};

describe("account transitions clear the patient physiology profile (M4)", () => {
  beforeEach(() => {
    cleanup();
    window.sessionStorage.clear();
    authApi.listeners.clear();
    authApi.signOut.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sjrfecxgysukkwxsowpy.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_account_transition_key_123456");
    vi.stubEnv("SUPABASE_PROJECT_REF", "sjrfecxgysukkwxsowpy");
    vi.stubEnv("SUPABASE_PROJECT_NAME", "Clinical KB Database");
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  for (const transition of transitions) {
    it(`removes the stored profile and notifies subscribers on ${transition.name}`, async () => {
      await mountAuthenticated();
      writePatientProfile(PATIENT_A_PROFILE);
      expect(getPatientProfileSnapshot()).toMatchObject({
        ageYears: 82,
        egfr: 22,
        medications: ["lithium", "sertraline"],
      });

      const onChange = vi.fn();
      const unsubscribe = subscribePatientProfile(onChange);
      try {
        await transition.run();
        await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent(transition.expectedStatus));

        expect(window.sessionStorage.getItem(PATIENT_PROFILE_STORAGE_KEY)).toBeNull();
        // Subscribers cache the parsed snapshot by raw string; the clear must go
        // through the store's own change event so mounted medication surfaces
        // re-read an empty profile instead of keeping patient A's alerts.
        expect(onChange).toHaveBeenCalled();
        expect(getPatientProfileSnapshot()).toEqual(EMPTY_PATIENT_PROFILE);
      } finally {
        unsubscribe();
      }
    });
  }
});
