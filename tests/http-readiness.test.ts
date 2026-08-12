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
        isReady: ({ statusCode, body }) => statusCode === 200 && body === "ready",
        timeoutMs: 1_000,
        requestTimeoutMs: 40,
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
        timeoutMs: 180,
        requestTimeoutMs: 40,
        pollIntervalMs: 5,
        timeoutErrorMessage: "readiness deadline elapsed",
      }),
    ).rejects.toThrow("readiness deadline elapsed");
    expect(requests).toBeGreaterThan(1);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });
});
