import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { waitForHttpReadiness } from "../scripts/lib/http-readiness.mjs";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    const fail = (error: Error) => reject(error);
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", fail);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("bounded HTTP readiness", () => {
  it("destroys stalled requests and resumes polling", async () => {
    let requests = 0;
    const url = await listen(
      createServer((_request, response) => {
        requests += 1;
        if (requests < 3) {
          response.writeHead(200, { "content-type": "text/plain" });
          response.write("partial");
          return;
        }
        response.end("ready");
      }),
    );

    await expect(
      waitForHttpReadiness({
        url,
        isReady: ({ statusCode, body }: { statusCode?: number; body: string }) =>
          statusCode === 200 && body === "ready",
        // The first two responses never end, so they consume the whole request
        // budget however large it is — the stall path is exercised either way.
        // What the budget must NOT do is cut off the THIRD response, which is
        // healthy: that misreads a good response as stalled and polls a fourth
        // time, failing this test's `toBe(3)`. At 40ms it did exactly that on a
        // Windows workstation, reproducibly, on an idle machine running this
        // file alone. Raised to 250ms, with the overall deadline lifted to keep
        // room for two full stalls plus the real attempt.
        timeoutMs: 5_000,
        requestTimeoutMs: 250,
        pollIntervalMs: 5,
      }),
    ).resolves.toBeUndefined();
    expect(requests).toBe(3);
  });

  it("honours the overall deadline when every response remains open", async () => {
    let requests = 0;
    const url = await listen(
      createServer((_request, response) => {
        requests += 1;
        response.writeHead(200, { "content-type": "text/plain" });
        response.write("partial");
      }),
    );
    const startedAt = Date.now();

    await expect(
      waitForHttpReadiness({
        url,
        isReady: () => false,
        // Every response stalls here, so each attempt costs the full 40ms and
        // the deadline decides how many fit. 180ms left room for four, which is
        // thin: one late timer on a loaded machine yields a single attempt and
        // fails `toBeGreaterThan(1)` — the shape reported from a Windows
        // workstation. 600ms fits roughly thirteen, so the assertion needs the
        // loop to actually poll rather than to win a race. The deadline is
        // still honoured and still bounded; both assertions below are unchanged.
        timeoutMs: 600,
        requestTimeoutMs: 40,
        pollIntervalMs: 5,
        timeoutErrorMessage: "readiness deadline elapsed",
      }),
    ).rejects.toThrow("readiness deadline elapsed");
    expect(requests).toBeGreaterThan(1);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });
});
