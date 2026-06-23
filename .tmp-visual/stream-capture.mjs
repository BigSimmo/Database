const query = 'What monitoring is required after starting lithium?';

(async () => {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 12000);

  try {
    const res = await fetch('http://localhost:4298/api/answer/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, filters: {}, queryMode: 'auto' }),
      signal: ctrl.signal,
    });

    console.log('STATUS', res.status, res.ok);
    if (!res.body) {
      console.log('NO_BODY');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let output = '';
    let done = false;

    while (!done && output.length < 20000) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        output += decoder.decode(value, { stream: true });
      }
    }

    console.log('STREAM_PREVIEW_START');
    console.log(output.slice(0, 3000));
    console.log('STREAM_PREVIEW_END');
  } catch (error) {
    if (String(error.name) === 'AbortError') {
      console.log('ABORTED_OK');
    } else {
      console.error('ERROR', error && error.message ? error.message : String(error));
    }
  }
})();
