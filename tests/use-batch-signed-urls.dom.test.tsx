/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: unknown) => void>();
  const session = {
    access_token: "batch-user-token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "batch-user" },
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

import { useBatchSignedImageUrls } from "@/components/clinical-dashboard/use-batch-signed-urls";
import { useSignedImageUrl } from "@/components/clinical-dashboard/use-signed-image-url";
import { clearSignedUrlCache, getCachedSignedUrl } from "@/lib/signed-url-cache";
import { AuthProvider } from "@/lib/supabase/client";

function BatchImageConsumer({ imageIds }: { imageIds: string[] }) {
  const { version } = useBatchSignedImageUrls(imageIds);
  return (
    <div>
      <span data-testid="batch-version">{version}</span>
      {imageIds.map((id) => (
        <SingleImageItem key={`${id}:${version}`} imageId={id} />
      ))}
    </div>
  );
}

function SingleImageItem({ imageId }: { imageId: string }) {
  const endpoint = `/api/images/${imageId}/signed-url`;
  const { url } = useSignedImageUrl(endpoint, true);
  return <div data-testid={`image-${imageId}`}>{url ?? "loading"}</div>;
}

describe("useBatchSignedImageUrls", () => {
  beforeEach(() => {
    clearSignedUrlCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    clearSignedUrlCache();
    vi.restoreAllMocks();
  });

  it("batches multiple image IDs in a single POST request and populates the cache", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (typeof input === "string" && input === "/api/images/signed-urls") {
        const body = JSON.parse(init?.body as string) as { imageIds: string[] };
        const urls: Record<string, { url: string; mimeType: string; caption: string; expiresAt: string }> = {};
        for (const id of body.imageIds) {
          urls[id] = {
            url: `https://signed.example.com/${id}.png`,
            mimeType: "image/png",
            caption: `Caption ${id}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          };
        }
        return new Response(JSON.stringify({ urls }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    });

    render(
      <AuthProvider>
        <BatchImageConsumer imageIds={["img-a", "img-b", "img-c"]} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("image-img-a").textContent).toBe("https://signed.example.com/img-a.png");
      expect(screen.getByTestId("image-img-b").textContent).toBe("https://signed.example.com/img-b.png");
      expect(screen.getByTestId("image-img-c").textContent).toBe("https://signed.example.com/img-c.png");
    });

    // Verify only 1 batch fetch was issued to /api/images/signed-urls
    const batchCalls = fetchSpy.mock.calls.filter(([url]) => url === "/api/images/signed-urls");
    expect(batchCalls.length).toBe(1);

    // Verify cache is populated
    expect(getCachedSignedUrl("/api/images/img-a/signed-url")?.url).toBe("https://signed.example.com/img-a.png");
    expect(getCachedSignedUrl("/api/images/img-b/signed-url")?.url).toBe("https://signed.example.com/img-b.png");
    expect(getCachedSignedUrl("/api/images/img-c/signed-url")?.url).toBe("https://signed.example.com/img-c.png");
  });
});
