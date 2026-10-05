import { test as base, expect, type Page } from '@playwright/test';
import { SCENARIOS, type Scenario } from '../scenarios.ts';
import { OBSERVER, post } from '../observer/post.ts';
import { Api } from './api.ts';
import { App } from './app.ts';
import { Env, type EnvOptions } from './env.ts';
import { pace } from './pace.ts';
import { aborted, breakScenario, limitOf, limitReached, LimitReached, readUsage, resetScenario } from './usage.ts';
import { BlackHole } from './offline.ts';
import { FakeCommandStream } from './voice.ts';
import { mirror } from './mirror.ts';
import { ScriptedModel } from './scripted.ts';

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
  /** The scripted model the runs of a scripted scenario talk to: what they do is up to the scenario */
  model: ScriptedModel;
  /** Runs step `i` of the scenario's list, under its title */
  step<T>(i: number, body: () => Promise<T>): Promise<T>;
  note(text: string): Promise<void>;
}

const WATCH_MS = 30_000;
/** Limits, in minutes, for scenarios without and with real runs */
const LIMITS = {
  /** Steps, runs and run messages all standing still this long: the scenario is stuck and fails */
  stall: { offline: 3, real: 5 },
  /** One step */
  step: { offline: 5, real: 25 },
  /** The whole scenario */
  scenario: { offline: 10, real: 60 },
};
const minutes = (env: string | undefined, fallback: number) => Number(env ?? fallback) * 60_000;
let STALL_MS = 0;
let STEP_MS = 0;

/** One observer window per worker: the scenarios of that worker load the app into it one after another */
const test = base.extend<object, { observer: Page }>({
  observer: [
    async ({ playwright }, use) => {
      // Tests run only in the test runner: pnpm e2e
      if (process.env.E2E_FROM_RUNNER !== '1') throw new Error('Tests run only in the test runner: pnpm e2e');
      // The installed Firefox, out of sight: the runner's page is watched in any browser, which shows the app as well
      const firefox = await playwright.firefox.launch({
        channel: 'moz-firefox',
        headless: true,
        firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true },
      });
      // Twice the pixels per point: what the runner's page shows of this window stays sharp on any screen
      const context = await firefox.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: 'dark' });
      const page = await context.newPage();
      // Marked as the page the runs drive: the runs load the app into it, not the page itself
      await page.goto(`${OBSERVER}/?driven`);
      await use(page);
      await firefox.close();
    },
    { scope: 'worker' },
  ],
});

/** The account's limits, shown in the observer; null when they cannot be read */
async function reading() {
  const u = await readUsage().catch(() => null);
  if (u) await post({ type: 'usage', ...u });
  return u;
}

/**
 * A scenario from the list, in its own world. A scenario with real runs is skipped when the account's 5-hour or weekly
 * limit is used up before it starts, and stopped (its back-end and runs killed) as soon as a reading during it finds
 * one used up; it fails only while there is room left. The test runner's Continue runs it again once the limit resets.
 */
export function scenario(id: string, opts: EnvOptions, body: (w: World) => Promise<void>): void {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`No scenario ${id} in scenarios.ts`);
  test(s.title, { annotation: { type: 'scenario', description: id }, tag: s.real ? '@real' : '@offline' }, async ({ observer }, info) => {
    // Live, no scenario's model is a stand-in: every run reaches the real Claude API and uses the account's limits
    const real = s.real || process.env.E2E_LIVE === '1';
    const kind = real ? 'real' : 'offline';
    STALL_MS = minutes(process.env.E2E_STALL_MINUTES, LIMITS.stall[kind]);
    STEP_MS = minutes(process.env.E2E_STEP_MINUTES, LIMITS.step[kind]);
    info.setTimeout(minutes(process.env.E2E_SCENARIO_MINUTES, LIMITS.scenario[kind]));
    resetScenario();
    if (real) {
      const limit = limitOf(await reading());
      test.skip(limit !== null, `${limit}: continue the run once it resets`);
    }
    /** Skips instead of failing when the scenario went wrong because the limit ran out under it */
    const outOfUsage = async (e: unknown): Promise<never> => {
      if (e instanceof LimitReached) test.skip(true, e.message);
      const limit = real ? limitOf(await reading()) : null;
      if (limit) test.skip(true, `${limit}: the scenario's runs were stopped; continue the run once it resets`);
      throw e;
    };

    const voice = new FakeCommandStream();
    const voicePort = opts.voice ? await voice.listen() : 0;
    const env = new Env(id, s.projects);
    // Reaching the real API, the stand-in passes everything on and records it, what it used included
    const model = new ScriptedModel(env.dir, real);
    const offline = real || s.scripted ? null : new BlackHole();
    const apiBase = s.scripted || real ? await model.listen() : offline ? await offline.listen() : null;
    // What the observer and the stall check follow: the scenario's projects and any other workspace it enables
    const followed = [...new Set<string>([...s.projects, ...(opts.enabled ?? [])])];
    const api = new Api(env);
    const app = new App(observer, env, api);
    let watch: NodeJS.Timeout | null = null;
    let stall: NodeJS.Timeout | null = null;
    // What this scenario's window shows, for the runner's page: from sign-in to the last step
    const screen = mirror(observer, id);
    let current = -1;
    let ok = false;
    const done = new Set<number>();
    try {
      await env.setUp(opts, voicePort, apiBase);
      await post({ type: 'env', id, appUrl: `${env.url}/`, databaseUrl: env.databaseUrl, workspaces: followed, dir: env.dir, token: env.token });
      await post({ type: 'note', text: `${s.title}: world at ${env.dir}, back-end ${env.url}` });
      if (real) {
        watch = setInterval(async () => {
          const limit = limitOf(await reading());
          if (!limit) return;
          limitReached(`${limit}: the scenario's runs were stopped; continue the run once it resets`);
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
          void post({ type: 'note', text: `${s.title}: stuck at step ${current}, stopping it` });
        }
      }, 10_000);
      await app.open();
      await app.signedIn();
      const world: World = {
        scenario: s,
        env,
        api,
        app,
        voice,
        offline,
        model,
        step: (i, fn) => {
          const title = s.steps[i];
          if (title === undefined) throw new Error(`${id} has no step ${i}`);
          done.add(i);
          current = i;
          return test.step(title, async () => {
            await pace('step', title);
            // Hard limits: the step ends at its timeout, or the moment the scenario breaks or runs out of usage,
            // whatever it is waiting on
            let timer: NodeJS.Timeout | undefined;
            const timeout = new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`Step ${i} timed out after ${STEP_MS / 60_000} minutes: ${title}`)), STEP_MS);
            });
            try {
              return await Promise.race([fn(), aborted, timeout]);
            } catch (e) {
              return await outOfUsage(e);
            } finally {
              clearTimeout(timer);
            }
          });
        },
        note: (text) => post({ type: 'note', text }),
      };
      const running = body(world);
      // The scripts are registered as the body starts: the runs waiting on the model go on now
      model.release();
      await Promise.race([running, aborted]).catch(outOfUsage);
      expect([...done].sort(), 'every step of the scenario ran').toEqual(s.steps.map((_, i) => i));
      ok = true;
    } finally {
      if (watch) clearInterval(watch);
      if (stall) clearInterval(stall);
      await screen.stop();
      const shot = await observer.screenshot().catch(() => null);
      if (shot) await info.attach('observer', { body: shot, contentType: 'image/png' });
      await post({ type: 'env-end', id });
      // The stand-in stops before the world goes: nothing it still answers writes into a folder that is gone
      if (s.scripted || real) await model.close();
      // What its runs used of the account, for the runner to show against the 5-hour limit
      if (real && model.spent.requests) await post({ type: 'spent', id, ...model.spent });
      await env.tearDown(!ok && process.env.E2E_CLEAN !== '1');
      if (!ok) await post({ type: 'note', text: `${s.title}: kept its world for inspection at ${env.dir} (log: ${env.log})` });
      if (opts.voice) await voice.close();
      await offline?.close();
      if (real) await reading();
    }
  });
}
