import { until, type RunRow } from '../support/api.ts';
import type { Project } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const PROJECTS: Project[] = ['todo-cli', 'bookshelf-api', 'handbook'];
const TOTAL = 2;

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
      const running = async (p: Project) => (await api.runs(p)).filter((r) => r.status === 'running');
      const counts = async () => Promise.all(PROJECTS.map(async (p) => (await running(p)).length));
      // One run per project at a time, in its one working directory, and never more than the total across them
      await until('runs in as many projects as the total allows', async () => (await counts()).reduce((a, b) => a + b, 0) === TOTAL);
      expect(Math.max(...(await counts()))).toBe(1);
      const busy = PROJECTS[(await counts()).indexOf(1)]!;
      const idle = PROJECTS[(await counts()).indexOf(0)]!;

      // On demand, by the user, in a project a run works in: it waits for that run, not beside it
      const { runId } = await api.runAutomation(busy, 'consistency-check', 'Check the project now.');
      await expect(api.runAutomation(busy, 'exploration')).rejects.toThrow(/does not start on demand/);
      await new Promise((r) => setTimeout(r, 9000));
      expect((await api.run(runId)).status).toBe('queued');
      expect(await running(busy)).toHaveLength(1);

      // The run working there ends: the user's run takes the working directory ahead of the automation runs queued
      // before it, in its project and in the project waiting for the total
      const [working] = await running(busy);
      await api.mcp('kill_run', { id: working!.id });
      await until('the on-demand run to start', async () => (await api.run(runId)).status === 'running');
      expect((await api.runs(busy)).filter((r) => r.trigger === 'schedule' && r.status === 'queued')).toHaveLength(1);
      expect(await running(idle)).toEqual([]);

      // Past the total, a chat the user starts waits too, and takes the first place that frees ahead of every automation run
      const chat = await app.chat(idle, 'What does this project hold?');
      await new Promise((r) => setTimeout(r, 9000));
      expect((await api.run(chat)).status).toBe('queued');
      await api.mcp('kill_run', { id: runId });
      await until('the chat to start', async () => (await api.run(chat)).status === 'running');
      expect((await counts()).reduce((a, b) => a + b, 0)).toBe(TOTAL);
      expect(Math.max(...(await counts()))).toBe(1);
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
