import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToMarkdown } from '../src/lib/markdown.js';
import { start, type Api } from './helpers.js';

let api: Api;
before(async () => (api = await start()));
after(() => api.close());

test('a note becomes a section with its tags', () => {
  const md = noteToMarkdown({ id: 1, title: 'Standup', body: 'Mondays.', tags: ['work', 'meetings'], createdAt: '', updatedAt: '' });
  assert.equal(md, '## Standup\n\n_Tags: #work #meetings_\n\nMondays.\n');
});

test('GET /export answers markdown, by tag when asked', async () => {
  const all = await api.request('GET', '/export');
  assert.equal(all.status, 200);
  assert.match(all.type, /text\/markdown/);
  assert.match(all.text, /^# Notes\n/);
  assert.equal((all.text.match(/^## /gm) ?? []).length, 3);
  const home = await api.request('GET', '/export?tag=home');
  assert.match(home.text, /^# Notes tagged #home\n/);
  assert.equal((home.text.match(/^## /gm) ?? []).length, 1);
});
