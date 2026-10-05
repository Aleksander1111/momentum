import { until, type RunRow } from '../support/api.ts';
import type { Project } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const PROJECTS: Project[] = ['todo-cli', 'bookshelf-api', 'handbook'];
const TOTAL = 4;

// The runs never get an answer: each stays running until the scenario ends, so the order the orchestrator keeps stands
// still long enough to be read. Offline their requests go nowhere; live the stand-in holds every one of them
scenario(
  'scheduling',
  { enabled: PROJECTS, triggers: ['consistency-check', 'retention'], settings: { feedSize: 5, agents: { concurrentTotal: TOTAL } } },
  async ({ api, app, model, step }) => {
    model.on('every run waits', () => true, () => [move.hang()]);
    const all = async () => (await Promise.all(PROJECTS.map((p) => api.runs(p)))).flat();
    const open = (rows: RunRow[]) => rows.filter((r) => r.status === 'running' || r.status === 'queued');

    await step(0, async () => {
      // The waiting default triggers fill a feed of five: due loops wait
      expect((await api.feed()).items).toHaveLength(5);
      await new Promise((r) => setTimeout(r, 12_000));
      expect(await all()).toEqual([]);
      await app.tab('Settings');
      await api.putSettings({ feedSize: 40 });
      // Both scheduled loops of every project are due at once
      const scheduled = async (p: Project) => (await api.runs(p)).filter((r) => r.trigger === 'schedule');
      await until('the due loops of every project', async () => (await Promise.all(PROJECTS.map(scheduled))).every((rows) => rows.length === 2));
      for (const p of PROJECTS) {
        const rows = await api.runs(p);
        expect(rows.filter((r) => r.trigger === 'schedule').map((r) => r.automation).sort()).toEqual(['consistency-check', 'retention']);
      }
    });

    await step(1, async () => {
      for (const p of PROJECTS) {
        await until(`an automation running in ${p}`, async () => (await api.runs(p)).some((r) => r.status === 'running'));
        const rows = await api.runs(p);
        expect(rows.filter((r) => r.status === 'running')).toHaveLength(1);
        expect(rows.filter((r) => r.status === 'queued')).toHaveLength(1);
      }
      expect(open(await all()).filter((r) => r.status === 'running')).toHaveLength(PROJECTS.length);

      // On demand, by the user: it starts at once next to the automation run of its project
      const { runId } = await api.runAutomation('todo-cli', 'consistency-check', 'Check the project now.');
      await until('the on-demand run to start', async () => (await api.run(runId)).status === 'running');
      await expect(api.runAutomation('todo-cli', 'exploration')).rejects.toThrow(/does not start on demand/);
      expect((await all()).filter((r) => r.status === 'running')).toHaveLength(TOTAL);

      // Past the total, a run the user starts waits too
      const chat = await app.chat('handbook', 'Which policies does the handbook have?');
      await new Promise((r) => setTimeout(r, 9000));
      expect((await api.run(chat)).status).toBe('queued');
      expect((await all()).filter((r) => r.status === 'running')).toHaveLength(TOTAL);

      // A run ending frees a place, and the user's chat takes it ahead of the queued automation run of its project
      await api.mcp('kill_run', { id: runId });
      await until('the chat to start', async () => (await api.run(chat)).status === 'running');
      expect((await all()).filter((r) => r.status === 'running')).toHaveLength(TOTAL);
    });

    await step(2, async () => {
      const feed = await api.feed();
      expect(feed.items.length).toBeLessThanOrEqual(40);
      expect(new Set(feed.items.map((i) => i.workspace))).toEqual(new Set(PROJECTS));
      const ranks = feed.items.map((i) => i.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
      await api.putSettings({ feedSize: 3 });
      expect((await api.feed()).items).toHaveLength(3);
      await app.tab('Feed');
      await expect(app.text(feed.items[0]!.title)).toBeVisible();
    });
  },
);
