import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from './config.mjs';
import { createHandler } from './server.mjs';
import { createStore } from './database.mjs';
import { handleHttp } from './function.mjs';

const environment = {
  AZURE_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  WARD_API_AUDIENCE: '9b7b160d-9bc7-4712-b748-17ff3e70b706',
  WARD_ALLOWED_OBJECT_ID: '22222222-2222-4222-8222-222222222222',
  AzureWebJobsStorage__accountName: 'wflowdev7273a083aue',
};
const config = readConfig(environment);
const id = environment.AZURE_TENANT_ID;
const body = { expectedRevision: 0, classification: 'synthetic', payload: { version: 5, state: { scenario: 'standard' } } };

test('configuration pins the existing storage account', () => {
  assert.equal(config.storage.account, 'wflowdev7273a083aue');
  assert.equal(config.storage.container, 'ward-flow-sessions');
  assert.equal(config.host, '127.0.0.1');
});
test('missing identity configuration fails closed', () => {
  for (const key of Object.keys(environment)) {
    const invalid = { ...environment }; delete invalid[key];
    assert.throws(() => readConfig(invalid), /configuration/);
  }
});
test('configuration refuses alternate storage accounts and wildcard origins', () => {
  assert.throws(() => readConfig({ ...environment, AzureWebJobsStorage__accountName: 'other' }));
  assert.throws(() => readConfig({ ...environment, WARD_ALLOWED_ORIGIN: '*' }));
});

function setup(overrides = {}) {
  const calls = [];
  const store = {
    read: async (...args) => { calls.push(['read', ...args]); return null; },
    save: async (...args) => { calls.push(['save', ...args]); return 1; },
    ready: async () => {},
    ...overrides,
  };
  return { calls, handler: createHandler({ config, store, authenticate: async token => {
    if (token !== 'Bearer accepted') throw new Error('secret diagnostic');
    return environment.WARD_ALLOWED_OBJECT_ID;
  } }) };
}
function request(method = 'GET', data, headers = {}) {
  return new Request(`http://localhost/v1/sessions/${id}`, {
    method, headers: { authorization: 'Bearer accepted', 'content-type': 'application/json', ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
test('unauthenticated calls never reach storage or expose diagnostics', async () => {
  const { handler, calls } = setup();
  const response = await handler(request('GET', undefined, { authorization: '' }));
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
  assert.doesNotMatch(await response.text(), /secret/);
});
test('approved caller can save a bounded synthetic snapshot', async () => {
  const { handler, calls } = setup();
  const response = await handler(request('PUT', body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revision: 1 });
  assert.equal(calls[0][1], environment.WARD_ALLOWED_OBJECT_ID);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('missing sessions are reported without inventing a successful restore', async () => {
  const { handler } = setup();
  assert.equal((await handler(request())).status, 404);
});
test('concurrent save conflicts return 409 instead of overwriting', async () => {
  const { handler } = setup({ save: async () => null });
  assert.equal((await handler(request('PUT', body))).status, 409);
});
test('real-data labels, malformed revisions and oversized bodies are rejected', async () => {
  const { handler, calls } = setup();
  for (const invalid of [
    { ...body, classification: 'clinical' },
    { ...body, expectedRevision: -1 },
    { ...body, expectedRevision: 0.5 },
    { ...body, payload: null },
  ]) assert.equal((await handler(request('PUT', invalid))).status, 400);
  assert.equal((await handler(request('PUT', { ...body, payload: { text: 'x'.repeat(1_048_577) } }))).status, 413);
  assert.equal(calls.length, 0);
});
test('cross-origin requests are denied before storage access', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request('PUT', body, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal(calls.length, 0);
});
test('storage failures return unavailable without credentials or payloads', async () => {
  const { handler } = setup({ read: async () => { throw new Error('password=secret'); } });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /password|secret/);
});
test('store scopes blobs by owner and uses conditional writes', async () => {
  const calls = [];
  let record;
  let etag = '"first"';
  const store = createStore({ ...config.storage, request: async (method, url, value, headers = {}) => {
    calls.push({ method, url, headers });
    if (url.endsWith('?restype=container')) return new Response(null, { status: 201 });
    if (method === 'GET') return record
      ? new Response(JSON.stringify(record), { status: 200, headers: { etag } })
      : new Response(null, { status: 404 });
    if (record && headers['if-match'] !== etag) return new Response(null, { status: 412 });
    if (!record && headers['if-none-match'] !== '*') return new Response(null, { status: 412 });
    record = JSON.parse(value);
    etag = '"second"';
    return new Response(null, { status: 201 });
  } });
  const owner = environment.WARD_ALLOWED_OBJECT_ID;
  assert.equal(await store.save(owner, id, 0, body.payload), 1);
  assert.equal((await store.read(owner, id)).revision, 1);
  assert.equal(await store.save(owner, id, 1, body.payload), 2);
  assert.equal(await store.save(owner, id, 1, body.payload), null);
  assert.ok(calls.filter(call => call.url.endsWith('.json')).every(call =>
    call.url.includes(`/${owner}/${id}.json`)));
  assert.equal(calls.find(call => call.headers['if-none-match'])?.headers['if-none-match'], '*');
  assert.equal(calls.find(call => call.headers['if-match'])?.headers['if-match'], '"second"');
});

test('readiness rejects a container that is being deleted', async () => {
  const store = createStore({ ...config.storage, request: async () =>
    new Response(null, { status: 409, headers: { 'x-ms-error-code': 'ContainerBeingDeleted' } }) });
  await assert.rejects(store.ready(), /container unavailable/);
});

test('a competing blob write rejects the stale revision', async () => {
  const store = createStore({ ...config.storage, request: async (method, url) => {
    if (url.endsWith('?restype=container')) return new Response(null, { status: 201 });
    if (method === 'GET') return new Response(JSON.stringify({ revision: 1, payload: {} }),
      { status: 200, headers: { etag: '"original"' } });
    return new Response(null, { status: 412 });
  } });
  assert.equal(await store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 1, body.payload), null);
});

test('Azure Functions adapter preserves the API response', async () => {
  const { handler } = setup();
  const incoming = request();
  const response = await handleHttp(incoming, async () => handler);
  assert.equal(response.status, 404);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.body.toString(), /Session not found/);
});
