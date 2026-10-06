import { cpus } from 'node:os';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { until } from '../support/api.ts';
import { REPO } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { plainText } from '../support/landed.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const SUPPORT = join(REPO, 'apps', 'backend', 'e2e', 'support').replaceAll('\\', '/');
/** The limits this world sets for runs, tighter than the defaults: what the jobs report shows they came from here */
const LIMITS = { MOMENTUM_RUN_MEMORY: '2G', MOMENTUM_RUN_CPUS: '2' };
const MEMORY = 2 * 1024 ** 3;
const CORES = Math.min(2, cpus().length);

interface JobLimits {
  inJob: boolean;
  jobMemoryLimited: boolean;
  jobMemoryLimit: number;
  affinityLimited: boolean;
  cores: number;
}

// The account's limits are what the scripted answers report, as the real API's headers do: the scenario moves them
scenario('run-accounting', { enabled: [WS], env: LIMITS }, async ({ env, api, app, model, step }) => {
  test.skip(model.live, 'The account limits are the real ones when live: the rises cannot be set');
  model.limits = { fiveHour: 10, week: 5 };
  let gate = Promise.resolve();
  let open = () => {};
  const hold = () => (gate = new Promise<void>((r) => (open = r)));
  model.on('chats answer once let through', { automation: 'chat', kind: 'prompt' }, (t) => (/^Usage/.test(t.input) ? [move.gate(gate), move.say('Answered.')] : undefined));

  /** Readings the harness took since a moment: one per usage call and per rate limit event of any run */
  const readings = async (since: Date) =>
    (await env.sql<{ n: number }[]>`select count(*)::int as n from harness.usage_sample where at >= ${since}`)[0]!.n;
  /** A chat whose first answer waits, once a reading was taken while it ran, so the next rise is partly its own */
  const started = async (question: string) => {
    const since = new Date();
    const { runId } = await api.chat(WS, question);
    await until(`${runId} waiting on its answer`, async () => model.turns(runId).length > 0, 2 * 60_000, 500);
    await until(`a reading while ${runId} runs`, async () => (await readings(since)) > 0, 60_000, 500);
    return runId;
  };
  const usage = async (id: string) => (await api.run(id)).usage;

  await step(0, async () => {
    await api.idle(WS, 60_000).catch(() => {});
    hold();
    const alone = await started('Usage: which routes are there?');
    // Six points of the 5-hour limit and three of the week go while it alone runs
    model.limits = { fiveHour: 16, week: 8 };
    open();
    expect((await api.runEnded(alone, 5 * 60_000)).status).toBe('finished');
    const u = await usage(alone);
    expect(u.fiveHour).toBeCloseTo(6, 6);
    expect(u.week).toBeCloseTo(3, 6);
    const shares = await env.sql<{ five_hour: number; week: number }[]>`select five_hour, week from ${env.sql('ws_bookshelf_api.usage_share')} where run_id = ${alone}`;
    expect(shares.reduce((s, r) => s + r.five_hour, 0)).toBeCloseTo(6, 6);
    const chat = (await api.metrics(WS)).agents.automations.find((a) => a.automation === 'chat')!;
    expect(chat.usage.fiveHour.value).toBeCloseTo(6, 6);
    await app.go(`/chat/${alone}`);
  });

  await step(1, async () => {
    hold();
    const [first, second] = [await started('Usage: which route creates a book?'), await started('Usage: where are the books kept?')];
    // Both running and both read: ten points go, split between them
    expect((await api.run(first)).status).toBe('running');
    model.limits = { fiveHour: 26, week: 12 };
    open();
    for (const id of [first, second]) expect((await api.runEnded(id, 5 * 60_000)).status).toBe('finished');
    for (const id of [first, second]) {
      const u = await usage(id);
      expect(u.fiveHour, id).toBeCloseTo(5, 6);
      expect(u.week, id).toBeCloseTo(2, 6);
    }
    // A run started afterwards takes only the rise while it runs
    hold();
    const later = await started('Usage: what does a missing book answer?');
    model.limits = { fiveHour: 30, week: 12 };
    open();
    expect((await api.runEnded(later, 5 * 60_000)).status).toBe('finished');
    expect((await usage(later)).fiveHour).toBeCloseTo(4, 6);
    expect((await usage(later)).week).toBeCloseTo(0, 6);
    for (const id of [first, second]) expect((await usage(id)).fiveHour).toBeCloseTo(5, 6);
  });

  await step(2, async () => {
    const measured = new Map<string, JobLimits>();
    const probe = (t: Turn) => {
      const out = t.results.find((r) => r.tool === 'Bash');
      if (out) measured.set(t.run, JSON.parse(/\{.*\}/s.exec(plainText(out.text))![0]) as JobLimits);
      return [move.bash(`powershell -NoProfile -ExecutionPolicy Bypass -File "${SUPPORT}/job-limits.ps1"`), move.say('Read the limits.')];
    };
    model.on('a chat reads its limits', (t) => t.automation === 'chat' && t.kind === 'prompt' && /limits/.test(t.input), probe);
    model.on('an automation reads its limits', (t) => t.automation === 'retention' && t.kind === 'prompt', probe);
    const chat = await api.chat(WS, 'What limits does this run have?');
    expect((await api.runEnded(chat.runId, 5 * 60_000)).status).toBe('finished');
    await api.approve(WS, 'Harness/Trigger/retention');
    const { runId: automation } = await api.runAutomation(WS, 'retention', 'Read the limits of this run.');
    expect((await api.runEnded(automation, 5 * 60_000)).status).toBe('finished');
    for (const id of [chat.runId, automation]) {
      const limits = measured.get(id);
      expect(limits, `what run ${id} read`).toBeTruthy();
      expect(limits!.inJob).toBe(true);
      expect(limits!.jobMemoryLimited).toBe(true);
      expect(limits!.jobMemoryLimit).toBe(MEMORY);
      expect(limits!.affinityLimited).toBe(true);
      expect(limits!.cores).toBe(CORES);
    }

    // A command that would take three gigabytes of a run held to two does not get them
    let committed: { committedGb: number; refused: string | null } | null = null;
    model.on('a runaway command', (t) => t.automation === 'chat' && t.kind === 'prompt' && /memory/.test(t.input), (t) => {
      const out = t.results.find((r) => r.tool === 'Bash');
      if (out) committed = JSON.parse(/\{.*\}/s.exec(plainText(out.text))?.[0] ?? 'null');
      return [move.bash(`node "${SUPPORT}/commit-memory.mjs" 3`), move.say('Tried.')];
    });
    const hungry = await api.chat(WS, 'Take three gigabytes of memory.');
    const ended = await api.runEnded(hungry.runId, 5 * 60_000);
    // Refused while the run goes on, or the run ended at the limit: never the three gigabytes
    if (ended.status === 'finished') {
      const c = committed as { committedGb: number; refused: string | null } | null;
      expect(c, 'what the command reported').toBeTruthy();
      expect(c!.committedGb).toBeLessThan(2);
      expect(c!.refused).toBeTruthy();
    } else expect(ended.status).toBe('failed');
    await app.go(`/chat/${hungry.runId}`);
  });
});
