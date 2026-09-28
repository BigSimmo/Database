// The existing Function storage account holds development-only sessions.
export async function openStorage(storage) {
  const { DefaultAzureCredential } = await import("@azure/identity");
  const credential = new DefaultAzureCredential();
  return {
    ...storage,
    async request(method, url, body, extraHeaders = {}) {
      const access = await credential.getToken("https://storage.azure.com/.default");
      if (!access) throw new Error("Storage identity unavailable");
      return fetch(url, {
        method,
        body,
        headers: {
          authorization: `Bearer ${access.token}`,
          "x-ms-version": "2023-11-03",
          "x-ms-date": new Date().toUTCString(),
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(6_000),
      });
    },
  };
}

export function createStore(client) {
  const base = `https://${client.account}.blob.core.windows.net/${client.container}`;
  let containerPromise;
  async function checkContainer() {
    const result = await client.request("PUT", `${base}?restype=container`);
    if (
      result.status !== 201 &&
      !(result.status === 409 && result.headers.get("x-ms-error-code") === "ContainerAlreadyExists")
    )
      throw new Error("Session container unavailable");
  }
  async function ensureContainer() {
    containerPromise ??= checkContainer().catch((error) => {
      containerPromise = undefined;
      throw error;
    });
    return containerPromise;
  }
  async function get(owner, id) {
    await ensureContainer();
    const url = `${base}/${encodeURIComponent(owner)}/${encodeURIComponent(id)}.json`;
    const result = await client.request("GET", url);
    if (result.status === 404) return { url, record: null, etag: null };
    if (result.status !== 200) throw new Error("Session read unavailable");
    const etag = result.headers.get("etag");
    if (!etag) throw new Error("Session version unavailable");
    return { url, record: await result.json(), etag };
  }
  return {
    // Readiness contacts storage on every probe so a later outage is reported.
    ready: checkContainer,
    async read(owner, id) {
      return (await get(owner, id)).record;
    },
    async save(owner, id, revision, payload) {
      const current = await get(owner, id);
      if ((current.record?.revision ?? 0) !== revision) return null;
      const next = { revision: revision + 1, payload, updated_at: new Date().toISOString() };
      const result = await client.request("PUT", current.url, JSON.stringify(next), {
        "content-type": "application/json",
        "x-ms-blob-type": "BlockBlob",
        [current.etag ? "if-match" : "if-none-match"]: current.etag ?? "*",
      });
      if (result.status === 412) return null;
      if (result.status !== 201) throw new Error("Session write unavailable");
      return next.revision;
    },
  };
}
