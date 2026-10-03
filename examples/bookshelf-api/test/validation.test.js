import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

let server;
let base;
before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('POST /books with an empty title answers 400', async () => {
  const res = await fetch(`${base}/books`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '', author: 'Nobody', year: 2020 }),
  });
  assert.equal(res.status, 400);
});
