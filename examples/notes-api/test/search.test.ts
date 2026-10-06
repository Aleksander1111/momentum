import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../src/search.js';
import { createMemoryStore, sampleNotes } from '../src/store/memory.js';
import { start, type Api } from './helpers.js';

let api: Api;
before(async () => (api = await start()));
after(() => api.close());

test('every word of the query must match; titles rank above bodies', () => {
  const notes = createMemoryStore(sampleNotes).all();
  assert.deepEqual(search(notes, 'coffee').map((n) => n.title), ['Groceries']);
  assert.deepEqual(search(notes, 'read').map((n) => n.title), ['Reading list']);
  assert.deepEqual(search(notes, 'work').map((n) => n.title), ['Standup', 'Reading list']);
  assert.deepEqual(search(notes, 'room standup').map((n) => n.title), ['Standup']);
  assert.deepEqual(search(notes, 'room groceries'), []);
});

test('GET /notes?q= searches', async () => {
  const { status, json } = await api.request('GET', '/notes?q=milk');
  assert.equal(status, 200);
  assert.deepEqual((json as { title: string }[]).map((n) => n.title), ['Groceries']);
});
