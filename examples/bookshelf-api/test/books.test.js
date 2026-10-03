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

const post = (body) =>
  fetch(`${base}/books`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('GET /books lists the seeded books', async () => {
  const res = await fetch(`${base}/books`);
  assert.equal(res.status, 200);
  const books = await res.json();
  assert.equal(books.length, 5);
  assert.deepEqual(Object.keys(books[0]), ['id', 'title', 'author', 'year']);
});

test('GET /books/:id answers one book, or 404', async () => {
  const found = await fetch(`${base}/books/2`);
  assert.equal(found.status, 200);
  assert.equal((await found.json()).title, 'Refactoring');

  const missing = await fetch(`${base}/books/99`);
  assert.equal(missing.status, 404);
});

test('POST /books adds a book', async () => {
  const res = await post({ title: 'Working Effectively with Legacy Code', author: 'Michael Feathers', year: 2004 });
  assert.equal(res.status, 201);
  const book = await res.json();
  assert.equal(book.id, 6);

  const fetched = await fetch(`${base}/books/${book.id}`);
  assert.equal((await fetched.json()).author, 'Michael Feathers');
});

test('POST /books without an author answers 400', async () => {
  const res = await post({ title: 'Anonymous' });
  assert.equal(res.status, 400);
});
