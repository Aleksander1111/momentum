import { test as base, expect, type Page } from '@playwright/test';
import { SCENARIOS, type Scenario } from '../scenarios.ts';
import { OBSERVER, post } from '../observer/post.ts';
import { Api } from './api.ts';
import { App } from './app.ts';
import { Env, type EnvOptions } from './env.ts';
import { pace } from './pace.ts';
import { breakScenario, cap, capReached, readUsage, resetCap } from './usage.ts';
import { BlackHole } from './offline.ts';
import { FakeCommandStream } from './voice.ts';

export { expect };

export interface World {
  scenario: Scenario;
  env: Env;
  api: Api;
  app: App;
  /** The fake command stream, when the scenario asked for voice */
  voice: FakeCommandStream;
  /** Where the runs of a scenario without real runs send their requests, never answered */
  offline: BlackHole | null;
  /** Runs step `i` of the scenario's list, under its title */
  step<T>(i: number, body: () => Promise<T>): Promise<T>;
  note(text: string): Promise<void>;
}

const HOLD = process.env.E2E_HOLD === '1';
const WATCH_MS = 30_000;
/** A scenario whose steps, runs and run messages all stand still this long is stuck, and fails */
const STALL_MS = Number(process.env.E2E_STALL_MINUTES ?? 8) * 60_000;

/** One observer window for the whole suite: the scenarios load the app into it one after another */
const test = base.extend<object, { observer: Page }>({
  observer: [
    async ({ browser }, use) => {
      const page = await browser.newPage({ viewport: null, colorScheme: 'dark' });
      await page.goto(OBSERVER);
      await use(page);
      if (HOLD) await page.waitForEvent('close', { timeout: 0 });
      await page.close().catch(() => {});
    },
    { scope: 'worker' },
  ],
});

async function reading(): Promise<number | null> {
  const u = await readUsage().catch(() => null);
  if (!u) return null;
  await post({ type: 'usage', fiveHour: u.fiveHour, week: u.week, cap: cap() });
  return u.fiveHour;
}

/**
 * A scenario from the list, in its own world. A scenario with real runs is skipped when the 5-hour reading is at the
 * cap before it starts, and stopped (its back-end and runs killed) as soon as a reading during it reaches the cap.
 */
export function scenario(id: string, opts: EnvOptions, body: (w: World) => Promise<void>): void {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`No scenario ${id} in scenarios.ts`);
  test(s.title, { annotation: { type: 'scenario', description: id }, tag: s.real ? '@real' : '@offline' }, async ({ observer }, info) => {
    info.setTimeout((s.real ? 120 : 20) * 60_000);
    resetCap();
    if (s.real) {
      const now = await reading();
      test.skip(now !== null && now >= cap(), `5-hour usage ${now}% is at the cap of ${cap()}%`);
    }

    const voice = new FakeCommandStream();
    const voicePort = opts.voice ? await voice.listen() : 0;
    const offline = s.real ? null : new BlackHole();
    const apiBase = offline ? await offline.listen() : null;
    const env = new Env(id, s.projects);
    // What the observer and the stall check follow: the scenario's projects and any other workspace it enables
    const followed = [...new Set<string>([...s.projects, ...(opts.enabled ?? [])])];
    const api = new Api(env);
    const app = new App(observer, env, api);
    let watch: NodeJS.Timeout | null = null;
    let stall: NodeJS.Timeout | null = null;
    let current = -1;
    let ok = false;
    const done = new Set<number>();
    try {
      await env.setUp(opts, voicePort, apiBase);
      await post({ type: 'env', id, appUrl: `${env.url}/`, databaseUrl: env.databaseUrl, workspaces: followed, dir: env.dir });
      await post({ type: 'note', text: `${s.title}: world at ${env.dir}, back-end ${env.url}` });
      if (s.real) {
        watch = setInterval(async () => {
          const now = await reading();
          if (now === null || now < cap()) return;
          capReached(`5-hour usage reached ${now}%, the cap of ${cap()}%; the scenario's runs were stopped`);
          env.stop();
        }, WATCH_MS);
      }
      let last = '';
      let moved = Date.now();
      stall = setInterval(async () => {
        const activity = await Promise.all(
          followed.map((p) =>
            env.sql.unsafe(`select (select count(*) from ws_${p.replace(/[^a-z0-9_]/g, '_')}.run_message) as m,
              (select string_agg(id || status, ',') from ws_${p.replace(/[^a-z0-9_]/g, '_')}.run) as r`).catch(() => []),
          ),
        );
        const key = `${current}:${JSON.stringify(activity)}`;
        if (key !== last) {
          last = key;
          moved = Date.now();
        } else if (Date.now() - moved > STALL_MS) {
          breakScenario(`Stuck at step ${current}: no step, run or message changed for ${STALL_MS / 60_000} minutes`);
        }
      }, 30_000);
      await app.open();
      await app.signedIn();
      const world: World = {
        scenario: s,
        env,
        api,
        app,
        voice,
        offline,
        step: (i, fn) => {
          const title = s.steps[i];
          if (title === undefined) throw new Error(`${id} has no step ${i}`);
          done.add(i);
          current = i;
          return test.step(title, async () => {
            await pace('step', title);
            return fn();
          });
        },
        note: (text) => post({ type: 'note', text }),
      };
      await body(world);
      expect([...done].sort(), 'every step of the scenario ran').toEqual(s.steps.map((_, i) => i));
      ok = true;
    } finally {
      if (watch) clearInterval(watch);
      if (stall) clearInterval(stall);
      const shot = await observer.screenshot().catch(() => null);
      if (shot) await info.attach('observer', { body: shot, contentType: 'image/png' });
      await post({ type: 'env-end' });
      await env.tearDown(!ok && process.env.E2E_CLEAN !== '1');
      if (!ok) await post({ type: 'note', text: `${s.title}: kept its world for inspection at ${env.dir} (log: ${env.log})` });
      if (opts.voice) await voice.close();
      await offline?.close();
      if (s.real) await reading();
    }
  });
}
