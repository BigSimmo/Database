(async () => {
  const query = 'What monitoring is required after starting lithium?';
  const abortMs = 6000;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), abortMs);

  try {
    const res = await fetch('http://localhost:4298/api/answer/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, filters: {}, queryMode: 'auto' }),
      signal: ctrl.signal,
    });
    console.log('status', res.status);
    console.log('ok', res.ok);
    console.log('type', res.headers.get('content-type'));
    console.log('cache-control', res.headers.get('cache-control'));
    console.log('connection', res.headers.get('connection'));
    console.log('transfer-encoding', res.headers.get('transfer-encoding'));
    console.log('x-powered-by', res.headers.get('x-powered-by'));
    console.log('server', res.headers.get('server'));
  } catch (error) {
    console.log('ERR', String(error.name), String(error.message));
  }
})();
