import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadWithEnv(envOverrides: Record<string, unknown>) {
  vi.doMock("@/lib/env", () => ({ env: envOverrides }));
  return import("../src/lib/webhooks/chat-notify");
}

function mockLogger() {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  vi.doMock("@/lib/logger", () => ({ logger }));
  return logger;
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

/**
 * The silence that hid a three-day outage.
 *
 * Between 2026-09-11 and 2026-09-14, 24 consecutive production deploys failed their healthcheck
 * and were rolled back. Each fired an `error`-severity notification through this function with
 * neither SLACK_WEBHOOK_URL nor DISCORD_WEBHOOK_URL set on either Railway service, so every one
 * was dropped without a trace while the receiver answered its provider `200 { forwarded: false }`.
 * `docs/webhooks.md` already described the gap in prose and that did not prevent it.
 *
 * `logger.error` is the specific requirement rather than any log at all: the logger forwards
 * warn/error to Sentry Logs, so the alert survives the absence of the very variable it is
 * complaining about. A discarded `info` notification is unremarkable and must stay quiet, or the
 * signal that matters is buried.
 */
describe("a notification with nowhere to go", () => {
  it("reports an error-severity drop at error level, so it reaches Sentry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const logger = mockLogger();
    const { postChatNotification } = await loadWithEnv({});

    const result = await postChatNotification({
      title: "Railway deploy failed: Database",
      text: "body",
      severity: "error",
    });

    expect(result.delivered).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [message, context] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toContain("discarded");
    expect(context).toMatchObject({ notificationTitle: "Railway deploy failed: Database", severity: "error" });
  });

  it("treats a warning-severity drop the same way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const logger = mockLogger();
    const { postChatNotification } = await loadWithEnv({});

    await postChatNotification({ title: "Railway deploy removed: worker", text: "body", severity: "warning" });

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("stays quiet for a routine info drop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const logger = mockLogger();
    const { postChatNotification } = await loadWithEnv({});

    await postChatNotification({ title: "Hi", text: "body" });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("says nothing once a destination exists, whatever the delivery outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const logger = mockLogger();
    const { postChatNotification } = await loadWithEnv({ SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x" });

    await postChatNotification({ title: "Hi", text: "body", severity: "error" });

    // postJson already reports a failed delivery; this block is only about having no destination.
    expect(logger.error).not.toHaveBeenCalled();
  });
});
