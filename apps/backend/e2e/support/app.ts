import { expect, type Frame, type Locator, type Page } from '@playwright/test';
import type { Api } from './api.ts';
import { until } from './api.ts';
import { PASSWORD, type Env } from './env.ts';
import { post } from '../observer/post.ts';
import { pace } from './pace.ts';

declare global {
  interface Window {
    loadApp(url: string): Promise<boolean>;
    loadTimeline(url: string): Promise<boolean>;
  }
}

/**
 * The web app inside the observer, used the way the user uses it: tabs, the feed's swipes, the chat composer, the
 * settings. Every action happens in the frame the observer shows, paced by its controls.
 */
export class App {
  constructor(
    private readonly observer: Page,
    private readonly env: Env,
    private readonly api: Api,
  ) {}

  frame(): Frame {
    return this.named('app');
  }

  /** The app's timeline the observer shows beside it */
  timeline(): Frame {
    return this.named('timeline');
  }

  private named(name: 'app' | 'timeline'): Frame {
    const f = this.observer.frame({ name });
    if (!f?.url().startsWith(this.env.url)) throw new Error(`The ${name} is not loaded in the observer`);
    return f;
  }

  text(text: string | RegExp, exact = true): Locator {
    return this.frame().getByText(text, { exact }).first();
  }

  async open(): Promise<void> {
    // Every scenario's back-end is on 127.0.0.1, so they share the session cookie: a stale one would look signed in
    // for a moment and then fall back to the sign-in page
    await this.observer.context().clearCookies();
    await this.observer.evaluate((url) => window.loadApp(url), `${this.env.url}/`);
    await this.frame().getByPlaceholder('Password').waitFor({ timeout: 30_000 });
    await this.signIn();
    await this.signedIn();
    // Signed in, the timeline beside the app shares its session
    await this.observer.evaluate((url) => window.loadTimeline(url), `${this.env.url}/timeline?embed=1`);
  }

  async signIn(password = PASSWORD): Promise<void> {
    await pace('action', 'Sign in');
    const f = this.frame();
    await f.getByPlaceholder('Password').fill(password);
    await f.getByText('Sign in', { exact: true }).click();
  }

  async signedIn(): Promise<void> {
    await this.frame().waitForURL(/\/feed/, { timeout: 30_000 });
    await expect(this.frame().getByPlaceholder('Password')).toHaveCount(0, { timeout: 30_000 });
  }

  async tab(name: 'Feed' | 'Explorer' | 'Chat' | 'Timeline' | 'Metrics' | 'Settings'): Promise<void> {
    await pace('action', `Open the ${name} tab`);
    // On a phone Settings is the icon in the top-right corner
    const target = name === 'Settings' ? this.frame().getByLabel('Settings', { exact: true }).or(this.text(name)).first() : this.text(name);
    await target.click();
    await this.frame().waitForURL(new RegExp(`/${name.toLowerCase()}`));
  }

  /** Opens a page of the app by its route, as a link would */
  async go(route: string): Promise<void> {
    await pace('action', `Open ${route}`);
    await this.frame().goto(`${this.env.url}${route}`);
  }

  async entity(ws: string, path: string): Promise<void> {
    await this.go(`/explorer/entity?ws=${encodeURIComponent(ws)}&path=${encodeURIComponent(path)}`);
  }

  // Feed

  /** The title on the top card of the feed, once the feed has shown one */
  async topTitle(): Promise<string> {
    await this.tab('Feed');
    const feed = await this.api.feed();
    const top = feed.items[0];
    if (!top) throw new Error('The feed is empty');
    await expect(this.text(top.title)).toBeVisible({ timeout: 30_000 });
    return top.title;
  }

  private async swipe(title: string, dx: number): Promise<void> {
    await pace('action', `Swipe "${title}" ${dx > 0 ? 'right' : 'left'}`);
    const box = await this.text(title).boundingBox();
    if (!box) throw new Error(`The card "${title}" is not on screen`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2 + 60;
    const m = this.observer.mouse;
    await m.move(x, y);
    await m.down();
    for (let i = 1; i <= 12; i++) {
      await m.move(x + (dx * i) / 12, y, { steps: 2 });
      await new Promise((r) => setTimeout(r, 40));
    }
    await m.up();
  }

  /** Swipes the card on top of the feed as the phone shows it, whether or not the back-end hears of it now */
  async swipeTop(title: string, approve: boolean): Promise<void> {
    await this.swipe(title, approve ? 320 : -320);
  }

  /** Approves a feed item: swiped right in the app when it is on top */
  async approve(ws: string, path: string): Promise<void> {
    const title = await this.onTop(ws, path);
    if (title) await this.swipe(title, 320);
    else await this.api.approve(ws, path);
    await this.left(ws, path);
  }

  /** Sends a feed item back with a comment; the chat run it starts */
  async sendBack(ws: string, path: string, comment: string): Promise<string> {
    const title = await this.onTop(ws, path);
    const since = new Date();
    if (title) {
      await this.swipe(title, -320);
      await this.sheet('Disapprove', comment, 'Send back');
    } else {
      await this.api.call('POST', `/feed/${encodeURIComponent(path)}/send-back`, { workspace: ws, comment, timeSpentMs: 1000 });
    }
    return (await until('the send back chat', async () => (await this.api.runs(ws, 'chat')).find((r) => r.created_at >= since))).id;
  }

  /** Resolves an issue with one of its options, picked on the card and swiped right; the chat run that resolves it */
  async resolve(ws: string, path: string, option: number): Promise<string> {
    const title = await this.onTop(ws, path);
    const since = new Date();
    if (title) {
      await pace('action', `Pick option ${option + 1}`);
      await this.frame().getByRole('radio').nth(option).click();
      await this.swipe(title, 320);
    } else {
      await this.api.call('POST', `/feed/${encodeURIComponent(path)}/resolve`, { workspace: ws, option, timeSpentMs: 1000 });
    }
    return (await until('the resolving chat', async () => (await this.api.runs(ws, 'chat')).find((r) => r.created_at >= since))).id;
  }

  /** Closes an issue as won't resolve, with the reason */
  async wontResolve(ws: string, path: string, reason: string): Promise<void> {
    const title = await this.onTop(ws, path);
    if (title) {
      await this.swipe(title, -320);
      await this.sheet('Your resolution', reason, "Won't resolve");
    } else {
      await this.api.call('POST', `/feed/${encodeURIComponent(path)}/wont-resolve`, { workspace: ws, comment: reason, timeSpentMs: 1000 });
    }
    await this.left(ws, path);
  }

  /** Resolves an issue in the user's own words, swiped left and sent; the chat run that applies it */
  async ownResolution(ws: string, path: string, text: string): Promise<string> {
    const title = await this.onTop(ws, path);
    const since = new Date();
    if (title) {
      await this.swipe(title, -320);
      await this.sheet('Your resolution', text, 'Send');
    } else {
      await this.api.call('POST', `/feed/${encodeURIComponent(path)}/resolve`, { workspace: ws, comment: text, timeSpentMs: 1000 });
    }
    return (await until('the resolving chat', async () => (await this.api.runs(ws, 'chat')).find((r) => r.created_at >= since))).id;
  }

  private async sheet(heading: string, text: string, button: string): Promise<void> {
    const f = this.frame();
    await f.getByText(heading, { exact: true }).waitFor();
    await pace('action', `Write "${text}"`);
    await f.locator('textarea').last().fill(text);
    await pace('action', `Tap ${button}`);
    await f.getByText(button, { exact: true }).click();
  }

  private async left(ws: string, path: string): Promise<void> {
    await until(`${path} to leave the feed`, async () => !(await this.api.feed()).items.some((i) => i.path === path && i.workspace === ws), 60_000);
  }

  /**
   * The feed shows one card at a time, highest rank first. When the item is on top, the app shows it and its title comes
   * back for the swipe; when other items rank above it, nothing else is touched and the action goes through the API, as
   * a second device would.
   */
  private async onTop(ws: string, path: string): Promise<string | null> {
    const item = await until(`${path} in the feed`, async () => (await this.api.feed()).items.find((i) => i.path === path && i.workspace === ws), 10 * 60_000);
    const [top] = (await this.api.feed()).items;
    await this.go('/feed');
    if (top?.path !== path || top.workspace !== ws) {
      await post({ type: 'note', text: `${item.title} is not on top of the feed: acting through the API` });
      return null;
    }
    await expect(this.text(item.title)).toBeVisible({ timeout: 30_000 });
    return item.title;
  }

  // Chat

  /** Starts a chat from the Chat tab; the run it started */
  async chat(ws: string, text: string): Promise<string> {
    await this.go(`/chat?ws=${encodeURIComponent(ws)}&compose=1`);
    const since = new Date();
    const input = this.frame().getByPlaceholder(/^Ask/).first();
    await pace('action', `Ask "${text}"`);
    await input.fill(text);
    await input.press('Enter');
    return (await until('the chat run', async () => (await this.api.runs(ws, 'chat')).find((r) => r.created_at >= since))).id;
  }

  /** Opens a chat and sends the next message in it */
  async reply(runId: string, text: string): Promise<void> {
    await this.go(`/chat/${runId}`);
    const input = this.frame().getByRole('textbox').last();
    await pace('action', `Reply "${text}"`);
    await input.fill(text);
    await input.press('Enter');
  }

  // Settings

  async setProject(name: string, enabled: boolean): Promise<void> {
    await this.tab('Settings');
    await this.text('Included projects').waitFor();
    const row = this.frame().locator('div', { has: this.frame().getByText(name, { exact: true }) }).filter({ has: this.frame().getByRole('switch') }).last();
    const toggle = row.getByRole('switch').first();
    await pace('action', `${enabled ? 'Enable' : 'Disable'} ${name}`);
    if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) await toggle.click();
    await until(`${name} ${enabled ? 'enabled' : 'disabled'}`, async () => (await this.api.settings()).projects.find((p) => p.name === name)?.enabled === enabled);
  }

  /** Holds the mic of the screen open, so what the command stream hears goes where this screen sends it */
  async speak(): Promise<void> {
    await pace('action', 'Tap the mic');
    await this.frame().getByLabel('Speak').first().click();
    await expect(this.frame().getByLabel('Stop listening').first()).toBeVisible({ timeout: 15_000 });
  }
}
