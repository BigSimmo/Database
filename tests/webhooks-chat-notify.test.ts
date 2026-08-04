import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadWithEnv(envOverrides: Record<string, unknown>) {
  vi.doMock("@/lib/env", () => ({ env: envOverrides }));
  return import("../src/lib/webhooks/chat-notify");
}

describe("postChatNotification", () => {
  it("posts to both Slack and Discord when configured", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { postChatNotification } = await loadWithEnv({
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x",
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/x",
    });

    const result = await postChatNotification({ title: "Hi", text: "body", severity: "error" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const callInit = (index: number) => (fetchMock.mock.calls[index] as unknown as [string, RequestInit])[1];
    const slackBody = JSON.parse(String(callInit(0).body));
    const discordBody = JSON.parse(String(callInit(1).body));
    expect(slackBody).toHaveProperty("text");
    expect(discordBody).toHaveProperty("content");
    expect(slackBody.text).toContain("Hi");
    expect(result.delivered).toBe(true);
    expect(result.slack.configured).toBe(true);
    expect(result.discord.configured).toBe(true);
  });

  it("reports undelivered and does not fetch when nothing is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { postChatNotification } = await loadWithEnv({});

    const result = await postChatNotification({ title: "Hi", text: "body" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
    expect(result.slack.configured).toBe(false);
  });

  it("never throws when a channel post fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { postChatNotification } = await loadWithEnv({ SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x" });

    const result = await postChatNotification({ title: "Hi", text: "body" });

    expect(result.delivered).toBe(false);
    expect(result.slack).toEqual({ configured: true, ok: false });
  });
});
