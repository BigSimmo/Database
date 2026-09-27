import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { readConfig } from './config.mjs';
import { createStore, openStorage } from './database.mjs';
import { createAuthenticator } from './auth.mjs';

const BODY_LIMIT = 1_048_576;
const SESSION_PATH = /^\/v1\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > BODY_LIMIT) throw new Error('too_large');
  if (!request.body) throw new Error('invalid');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}

export function createHandler({ config, store, authenticate }) {
  return async request => {
    const origin = request.headers.get('origin');
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const respond = (status, value) => Response.json(value, { status, headers });
    if (origin && origin !== config.origin) return respond(403, { error: 'Origin not allowed' });
    if (origin) { headers['access-control-allow-origin'] = origin; headers.vary = 'Origin'; }
    const path = new URL(request.url).pathname;
    if (path === '/healthz' && request.method === 'GET') return respond(200, { service: 'ward-flow-backend' });
    const match = SESSION_PATH.exec(path);
    if (!match && path !== '/readyz') return respond(404, { error: 'Not found' });
    if (request.method === 'OPTIONS' && origin) return new Response(null, {
      status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, PUT, OPTIONS',
        'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-max-age': '600' },
    });
    let owner;
    try { owner = await authenticate(request.headers.get('authorization')); }
    catch { return respond(401, { error: 'Sign in with the authorised Microsoft account' }); }
    try {
      if (path === '/readyz' && request.method === 'GET') {
        await store.ready(); return respond(200, { storage: 'ready' });
      }
      if (!match) return respond(405, { error: 'Method not allowed' });
      if (request.method === 'GET') {
        const result = await store.read(owner, match[1]);
        return result ? respond(200, result) : respond(404, { error: 'Session not found' });
      }
      if (request.method !== 'PUT') return respond(405, { error: 'Method not allowed' });
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
        return respond(415, { error: 'JSON required' });
      let body;
      try { body = await readBody(request); }
      catch (error) { return respond(error.message === 'too_large' ? 413 : 400, { error: 'Invalid snapshot' }); }
      if (!object(body) || body.classification !== 'synthetic' || !object(body.payload) ||
        !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 ||
        body.expectedRevision >= 2_147_483_646)
        return respond(400, { error: 'A synthetic snapshot and valid revision are required' });
      const revision = await store.save(owner, match[1], body.expectedRevision, body.payload);
      return revision === null ? respond(409, { error: 'Session changed; reload before saving' }) : respond(200, { revision });
    } catch { return respond(503, { error: 'Storage unavailable; changes were not confirmed saved' }); }
  };
}

export function listen(handler, config) {
  const server = createServer({ maxHeaderSize: 20_480, requestTimeout: 15_000, headersTimeout: 10_000 }, async (incoming, outgoing) => {
    try {
      const request = new Request(`http://backend${incoming.url}`, {
        method: incoming.method, headers: incoming.headers,
        ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
      });
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500, { 'cache-control': 'no-store' }); outgoing.end(); }
  });
  server.maxConnections = 16;
  server.setTimeout(15_000, socket => socket.destroy());
  return server.listen(config.port, config.host);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = readConfig();
    const storage = await openStorage(config.storage);
    const authenticate = await createAuthenticator(config);
    const server = listen(createHandler({ config, store: createStore(storage), authenticate }), config);
    const close = () => { server.close(); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
    server.on('error', () => { console.error('Backend listener unavailable'); close(); process.exitCode = 1; });
    server.on('listening', () => console.log('Ward Flow backend listening; authenticated readiness check required'));
  } catch { console.error('Backend configuration or identity unavailable'); process.exitCode = 1; }
}
