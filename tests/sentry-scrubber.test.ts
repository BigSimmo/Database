import { describe, expect, it, vi } from "vitest";
import {
  sentryBeforeBreadcrumb,
  sentryBeforeSend,
  sentryBeforeSendTransaction,
  sentryPrivacyHooks,
} from "../src/lib/sentry-scrubber";

type ErrorEvent = { type: undefined; [key: string]: unknown };
type TransactionEvent = { type: "transaction"; [key: string]: unknown };
type Breadcrumb = { message?: string; data?: Record<string, unknown>; [key: string]: unknown };

describe("sentryPrivacyHooks", { concurrent: false }, () => {
  it("exports the three fail-closed hooks plus sendDefaultPii:false", () => {
    expect(sentryPrivacyHooks.beforeSend).toBe(sentryBeforeSend);
    expect(sentryPrivacyHooks.beforeSendTransaction).toBe(sentryBeforeSendTransaction);
    expect(sentryPrivacyHooks.beforeBreadcrumb).toBe(sentryBeforeBreadcrumb);
    expect(sentryPrivacyHooks.sendDefaultPii).toBe(false);
  });

  it("redacts clinical query URLs and secrets from error events", () => {
    const event = {
      type: undefined,
      message: "failed https://psychiatry.tools/dsm?q=patient's%20suicidal%20thoughts",
      exception: {
        values: [
          {
            type: "Error",
            value: "sb_secret_abcdef1234567890 while handling query",
            stacktrace: {
              frames: [{ filename: "/users/patient/source.pdf", vars: { query: "clozapine ANC" } }],
            },
          },
        ],
      },
      request: {
        url: "https://psychiatry.tools/answer?q=clozapine%20(ANC)",
        headers: { authorization: "Bearer secret" },
        cookies: { session: "abc" },
        data: { prompt: "clinical text" },
      },
      user: { id: "user-1", email: "clinician@example.com", ip_address: "1.2.3.4" },
      tags: { query: "clozapine", route: "/answer" },
      extra: { answer: "do not leak", safe: "ok" },
      breadcrumbs: [
        {
          message: "nav https://psychiatry.tools/dsm?q=clozapine",
          data: { query: "clozapine" },
        },
      ],
    } as ErrorEvent;

    const scrubbed = sentryBeforeSend(event as never);
    expect(scrubbed).not.toBeNull();
    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toContain("suicidal");
    expect(serialized).not.toContain("clozapine");
    expect(serialized).not.toContain("sb_secret_");
    expect(serialized).not.toContain("clinician@example.com");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("do not leak");
    expect(scrubbed!.message).toContain("[url]");
    expect((scrubbed!.exception as { values: Array<{ value: string }> }).values[0].value).toContain("[secret]");
    expect((scrubbed!.request as { headers: string }).headers).toBe("[redacted]");
    expect(scrubbed!.user).toEqual({ id: "user-1" });
    expect((scrubbed!.tags as { query: string }).query).toBe("[redacted]");
    expect((scrubbed!.extra as { answer: string; safe: string }).answer).toBe("[redacted]");
    expect((scrubbed!.extra as { answer: string; safe: string }).safe).toBe("ok");
    expect(
      (scrubbed!.exception as { values: Array<{ stacktrace: { frames: Array<{ vars?: unknown }> } }> }).values[0]
        .stacktrace.frames[0].vars,
    ).toBeUndefined();
  });

  it("redacts transaction URLs and drops breadcrumbs that cannot be scrubbed", () => {
    const event = {
      type: "transaction",
      transaction: "GET /answer?q=clozapine%20ANC",
      request: { url: "https://psychiatry.tools/answer?q=clozapine%20ANC" },
    } as TransactionEvent;

    const scrubbed = sentryBeforeSendTransaction(event as never);
    expect(scrubbed).not.toBeNull();
    expect(JSON.stringify(scrubbed)).not.toContain("clozapine");
    expect(scrubbed!.transaction).toContain("[query]");
  });

  it("redacts breadcrumb messages and sensitive data keys", () => {
    const crumb = sentryBeforeBreadcrumb({
      message: "fetch https://psychiatry.tools/dsm?q=patient's%20suicidal%20thoughts",
      data: { query: "keep private", path: "/ok" },
    } as Breadcrumb);
    expect(crumb).not.toBeNull();
    expect(JSON.stringify(crumb)).not.toContain("suicidal");
    expect(crumb!.data?.query).toBe("[redacted]");
  });

  it("fails closed when event scrubbing throws", () => {
    const event = {
      type: undefined,
      get message() {
        throw new Error("boom");
      },
      set message(_value: string) {
        /* ignore */
      },
    } as ErrorEvent;
    expect(sentryBeforeSend(event as never)).toBeNull();
  });

  it("fails closed when breadcrumb scrubbing throws", () => {
    const crumb = {
      get message() {
        throw new Error("boom");
      },
      set message(_value: string) {
        /* ignore */
      },
    } as Breadcrumb;
    expect(sentryBeforeBreadcrumb(crumb)).toBeNull();
  });

  it("fails closed when transaction scrubbing throws", () => {
    const event = {
      type: "transaction",
      get transaction() {
        throw new Error("boom");
      },
      set transaction(_value: string) {
        /* ignore */
      },
    } as TransactionEvent;
    expect(sentryBeforeSendTransaction(event as never)).toBeNull();
  });

  it("is wired into all three Sentry.init call sites", async () => {
    const init = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({
      init,
      captureRouterTransitionStart: vi.fn(),
      captureRequestError: vi.fn(),
    }));

    vi.resetModules();
    const {
      sentryBeforeSend: beforeSend,
      sentryBeforeSendTransaction: beforeTxn,
      sentryBeforeBreadcrumb: beforeCrumb,
    } = await import("../src/lib/sentry-scrubber");
    await import("../src/sentry.server.config");
    await import("../src/sentry.edge.config");
    // Client file also configures Zod JIT; import after the Sentry mock.
    await import("../src/instrumentation-client");

    expect(init).toHaveBeenCalledTimes(3);
    for (const [options] of init.mock.calls) {
      expect(options.beforeSend).toBe(beforeSend);
      expect(options.beforeSendTransaction).toBe(beforeTxn);
      expect(options.beforeBreadcrumb).toBe(beforeCrumb);
      expect(options.sendDefaultPii).toBe(false);
    }
  });
});
