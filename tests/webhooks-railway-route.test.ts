import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "railway-webhook-secret-value-123";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadRoute(envOverrides: Record<string, unknown>) {
  const postChatNotification = vi.fn(async () => ({
    delivered: true,
    slack: { configured: true, ok: true, status: 200 },
    discord: { configured: false, ok: false },
  }));
  vi.doMock("@/lib/env", () => ({ env: envOverrides }));
  vi.doMock("@/lib/webhooks/chat-notify", () => ({ postChatNotification }));
  const route = await import("../src/app/api/webhooks/railway/route");
  return { route, postChatNotification };
}

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/railway", () => {
  it("returns 503 when the receiver secret is unset", async () => {
    const { route } = await loadRoute({});
    const response = await route.POST(post("http://localhost/api/webhooks/railway", { status: "SUCCESS" }));
    expect(response.status).toBe(503);
  });

  it("returns 401 on a bad token", async () => {
    const { route } = await loadRoute({ RAILWAY_WEBHOOK_SECRET: SECRET });
    const response = await route.POST(post("http://localhost/api/webhooks/railway?token=wrong", { status: "SUCCESS" }));
    expect(response.status).toBe(401);
  });

  it("skips transient statuses without notifying", async () => {
    const { route, postChatNotification } = await loadRoute({ RAILWAY_WEBHOOK_SECRET: SECRET });
    const response = await route.POST(
      post(`http://localhost/api/webhooks/railway?token=${SECRET}`, { status: "BUILDING" }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.skipped).toBe(true);
    expect(postChatNotification).not.toHaveBeenCalled();
  });

  it("forwards a notable deploy status to chat", async () => {
    const { route, postChatNotification } = await loadRoute({ RAILWAY_WEBHOOK_SECRET: SECRET });
    const response = await route.POST(
      post(`http://localhost/api/webhooks/railway?token=${SECRET}`, {
        type: "DEPLOY",
        status: "FAILED",
        project: { name: "Database" },
        environment: { name: "production" },
        service: { name: "worker" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.forwarded).toBe(true);
    expect(postChatNotification).toHaveBeenCalledTimes(1);
    const notification = (postChatNotification.mock.calls[0] as unknown as [{ severity: string; title: string }])[0];
    expect(notification.severity).toBe("error");
    expect(notification.title).toContain("worker");
  });
});
