import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { distinctTags, normaliseTag, tagCounts } from '../src/domain/tag.js';
import { start, type Api } from './helpers.js';

let api: Api;
before(async () => (api = await start()));
after(() => api.close());

test('tags are normalised and deduplicated', () => {
  assert.equal(normaliseTag('  Work Notes '), 'work-notes');
  assert.deepEqual(distinctTags(['Work', 'work', ' home', '']), ['work', 'home']);
});

test('tag counts come most used first, then by name', () => {
  const counts = tagCounts([{ tags: ['work', 'home'] }, { tags: ['work'] }, { tags: ['books'] }]);
  assert.deepEqual(counts, [
    { tag: 'work', notes: 2 },
    { tag: 'books', notes: 1 },
    { tag: 'home', notes: 1 },
  ]);
});

test('GET /tags lists the tags in use; GET /notes?tag= keeps one tag', async () => {
  const tags = await api.request('GET', '/tags');
  assert.equal(tags.status, 200);
  assert.deepEqual((tags.json as { tag: string }[]).map((t) => t.tag), ['work', 'books', 'home', 'meetings']);
  const work = await api.request('GET', '/notes?tag=Work');
  assert.equal((work.json as unknown[]).length, 2);
});
