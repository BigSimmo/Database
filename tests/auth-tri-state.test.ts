import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    SUPABASE_PROJECT_REF: "sjrfecxgysukkwxsowpy",
  },
}));

import { publicAccessContext } from "@/lib/public-api-access";
import { AuthenticationError, getOptionalAuthenticatedUser, resolveOptionalAuthentication } from "@/lib/supabase/auth";

function authClient(result: unknown) {
  return {
    auth: {
      getUser: vi.fn(async () => result),
    },
  };
}

describe("optional authentication", () => {
  it("distinguishes absent credentials without calling Supabase auth", async () => {
    const client = authClient({ data: { user: null }, error: null });
    const request = new Request("http://localhost/api/search");

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toEqual({ status: "absent" });
    expect(client.auth.getUser).not.toHaveBeenCalled();
    await expect(getOptionalAuthenticatedUser(request, client as never)).resolves.toBeNull();
  });

  it("returns a valid bearer user with immutable app metadata", async () => {
    const client = authClient({
      data: { user: { id: "user-1", app_metadata: { site_role: "administrator" } } },
      error: null,
    });
    const request = new Request("http://localhost/api/search", {
      headers: { authorization: "Bearer valid-token" },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toEqual({
      status: "valid",
      user: { id: "user-1", appMetadata: { site_role: "administrator" } },
    });
    expect(client.auth.getUser).toHaveBeenCalledWith("valid-token");
  });

  it("rejects a presented bearer credential that Supabase reports as invalid", async () => {
    const client = authClient({
      data: { user: null },
      error: { message: "Invalid token" },
    });
    const request = new Request("http://localhost/api/search", {
      headers: { authorization: "Bearer expired-token" },
    });

    await expect(getOptionalAuthenticatedUser(request, client as never)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects a malformed authorization header without trying cookie fallback", async () => {
    const client = authClient({
      data: { user: { id: "user-1", app_metadata: {} } },
      error: null,
    });
    const request = new Request("http://localhost/api/search", {
      headers: {
        authorization: "Basic credentials",
        cookie: "sb-access-token=valid-cookie-token",
      },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toEqual({ status: "invalid" });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("does not let a valid cookie override an invalid bearer credential", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async (token: string) =>
          token === "valid-cookie-token"
            ? { data: { user: { id: "user-1", app_metadata: {} } }, error: null }
            : { data: { user: null }, error: { message: "Invalid token" } },
        ),
      },
    };
    const request = new Request("http://localhost/api/search", {
      headers: {
        authorization: "Bearer expired-token",
        cookie: "sb-access-token=valid-cookie-token",
      },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toEqual({ status: "invalid" });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.auth.getUser).toHaveBeenCalledWith("expired-token");
  });

  it("validates a legacy session cookie when no authorization header is present", async () => {
    const client = authClient({ data: { user: { id: "user-1", app_metadata: {} } }, error: null });
    const request = new Request("http://localhost/api/search", {
      headers: { cookie: "sb-access-token=valid-cookie-token" },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toMatchObject({
      status: "valid",
      user: { id: "user-1" },
    });
    expect(client.auth.getUser).toHaveBeenCalledWith("valid-cookie-token");
  });

  it("prefers a current Supabase session cookie over a stale legacy access-token cookie", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async (token: string) =>
          token === "current-cookie-token"
            ? { data: { user: { id: "user-1", app_metadata: {} } }, error: null }
            : { data: { user: null }, error: { message: "Invalid token" } },
        ),
      },
    };
    const currentSession = encodeURIComponent(
      JSON.stringify({ access_token: "current-cookie-token", refresh_token: "refresh-token", type: "bearer" }),
    );
    const request = new Request("http://localhost/api/search", {
      headers: {
        cookie: `sb-access-token=expired-legacy-token; sb-sjrfecxgysukkwxsowpy-auth-token=${currentSession}`,
      },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toMatchObject({
      status: "valid",
      user: { id: "user-1" },
    });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.auth.getUser).toHaveBeenCalledWith("current-cookie-token");
  });

  it("ignores a stale project's session cookie when the live legacy token is valid", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async (token: string) =>
          token === "valid-legacy-token"
            ? { data: { user: { id: "user-1", app_metadata: {} } }, error: null }
            : { data: { user: null }, error: { message: "Invalid token" } },
        ),
      },
    };
    const staleSession = encodeURIComponent(
      JSON.stringify({ access_token: "stale-project-token", refresh_token: "refresh-token", type: "bearer" }),
    );
    const request = new Request("http://localhost/api/search", {
      headers: {
        cookie: `sb-qjgitjyhxrwxsrydablr-auth-token=${staleSession}; sb-access-token=valid-legacy-token`,
      },
    });

    await expect(resolveOptionalAuthentication(request, client as never)).resolves.toMatchObject({
      status: "valid",
      user: { id: "user-1" },
    });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.auth.getUser).toHaveBeenCalledWith("valid-legacy-token");
  });

  it("rejects a legacy session cookie that Supabase reports as invalid", async () => {
    const client = authClient({ data: { user: null }, error: { message: "Invalid token" } });
    const request = new Request("http://localhost/api/search", {
      headers: { cookie: "sb-access-token=expired-cookie-token" },
    });

    await expect(getOptionalAuthenticatedUser(request, client as never)).rejects.toBeInstanceOf(AuthenticationError);
    expect(client.auth.getUser).toHaveBeenCalledWith("expired-cookie-token");
  });

  it("propagates dependency failures instead of treating them as anonymous", async () => {
    const client = {
      auth: { getUser: vi.fn(async () => Promise.reject(new Error("Supabase unavailable"))) },
    };
    const request = new Request("http://localhost/api/search", {
      headers: { authorization: "Bearer valid-token" },
    });

    await expect(getOptionalAuthenticatedUser(request, client as never)).rejects.toThrow("Supabase unavailable");
  });

  it("never constructs anonymous access for invalid credentials", async () => {
    const client = authClient({ data: { user: null }, error: { message: "Invalid token" } });
    const invalidRequest = new Request("http://localhost/api/search", {
      headers: { authorization: "Bearer expired-token", "x-real-ip": "198.51.100.10" },
    });
    const anonymousRequest = new Request("http://localhost/api/search", {
      headers: { "x-real-ip": "198.51.100.10" },
    });

    await expect(publicAccessContext(invalidRequest, client as never)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(publicAccessContext(anonymousRequest, client as never)).resolves.toMatchObject({
      authenticated: false,
      ownerId: undefined,
      rateLimitSubject: { kind: "anonymous" },
    });
  });
});
