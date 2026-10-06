import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, type Api } from './helpers.js';

let api: Api;
before(async () => (api = await start()));
after(() => api.close());

test('GET /notes lists the sample notes', async () => {
  const { status, json } = await api.request('GET', '/notes');
  assert.equal(status, 200);
  assert.equal((json as unknown[]).length, 3);
});

test('GET /notes/:id reads one note and 404s on a missing one', async () => {
  const one = await api.request('GET', '/notes/1');
  assert.equal(one.status, 200);
  assert.equal((one.json as { title: string }).title, 'Standup');
  assert.equal((await api.request('GET', '/notes/99')).status, 404);
  assert.equal((await api.request('GET', '/notes/abc')).status, 400);
});

test('POST /notes creates a note with normalised tags', async () => {
  const { status, json } = await api.request('POST', '/notes', { title: 'Dentist', body: 'Thursday 9:00', tags: ['Home', 'health ', 'home'] });
  assert.equal(status, 201);
  const note = json as { id: number; tags: string[] };
  assert.equal(note.id, 4);
  assert.deepEqual(note.tags, ['home', 'health']);
});

test('POST /notes refuses a note without a title, and a body that is not JSON', async () => {
  const empty = await api.request('POST', '/notes', { title: '  ', body: 'x' });
  assert.equal(empty.status, 400);
  assert.ok(Array.isArray((empty.json as { details: unknown }).details));
  assert.equal((await api.request('POST', '/notes', '{not json')).status, 400);
});

test('PATCH /notes/:id changes what is sent and keeps the rest', async () => {
  const { status, json } = await api.request('PATCH', '/notes/2', { body: 'Milk, bread, coffee beans, oats.' });
  assert.equal(status, 200);
  const note = json as { title: string; body: string; tags: string[] };
  assert.equal(note.title, 'Groceries');
  assert.match(note.body, /oats/);
  assert.deepEqual(note.tags, ['home']);
});

test('DELETE /notes/:id removes the note', async () => {
  assert.equal((await api.request('DELETE', '/notes/3')).status, 204);
  assert.equal((await api.request('GET', '/notes/3')).status, 404);
  assert.equal((await api.request('DELETE', '/notes/3')).status, 404);
});

test('an unknown path is 404, a known path under the wrong method 405', async () => {
  assert.equal((await api.request('GET', '/nowhere')).status, 404);
  assert.equal((await api.request('PUT', '/notes')).status, 405);
});
