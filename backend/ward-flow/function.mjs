import { app } from "@azure/functions";
import { readConfig } from "./config.mjs";
import { openStorage, createStore } from "./database.mjs";
import { createAuthenticator } from "./auth.mjs";
import { createHandler } from "./server.mjs";

let handlerPromise;

function handler() {
  handlerPromise ??= (async () => {
    const config = readConfig();
    const storage = await openStorage(config.storage);
    return createHandler({ config, store: createStore(storage), authenticate: await createAuthenticator(config) });
  })().catch((error) => {
    handlerPromise = undefined;
    throw error;
  });
  return handlerPromise;
}

export async function handleHttp(request, getHandler = handler) {
  try {
    const webRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      ...(["GET", "HEAD"].includes(request.method) ? {} : { body: request.body, duplex: "half" }),
    });
    const response = await (await getHandler())(webRequest);
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    };
  } catch {
    return { status: 503, headers: { "cache-control": "no-store" }, jsonBody: { error: "Service unavailable" } };
  }
}

// Easy Auth authenticates at the host; the handler verifies the signed API token again.
app.http("wardFlowHealth", { route: "healthz", methods: ["GET"], authLevel: "anonymous", handler: handleHttp });
app.http("wardFlowReady", { route: "readyz", methods: ["GET"], authLevel: "anonymous", handler: handleHttp });
app.http("wardFlowSession", {
  route: "v1/sessions/{id}",
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  handler: handleHttp,
});
