import { expect, test } from '@playwright/test';

const password = process.env.MOMENTUM_PASSWORD ?? '';

test.beforeEach(async ({ page }) => {
  test.skip(!password, 'MOMENTUM_PASSWORD is not set');
  await page.goto('/');
  await page.getByPlaceholder('Password').fill(password);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL('**/feed');
});

test('a wrong password stays on the session page', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.getByPlaceholder('Password').fill('wrong');
  await page.getByText('Sign in', { exact: true }).click();
  await expect(page).toHaveURL(/session/);
});

test('the feed shows the top ranked card', async ({ page }) => {
  const request = page.request;
  const feed = await (await request.get('/feed')).json();
  test.skip(feed.items.length === 0, 'the feed is empty');
  await expect(page.getByText(feed.items[0].title, { exact: true }).first()).toBeVisible();
});

test('every tab loads without a page title', async ({ page }) => {
  for (const tab of ['Explorer', 'Chat', 'Metrics', 'Settings', 'Feed']) {
    await page.getByText(tab, { exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(tab.toLowerCase()));
  }
  await page.getByText('Metrics', { exact: true }).first().click();
  await expect(page.getByText('Rolling 5 hours')).toBeVisible();
  await expect(page.getByText('$')).toHaveCount(0);
  await page.getByText('Settings', { exact: true }).first().click();
  await expect(page.getByText('Included projects')).toBeVisible();
});

test('the explorer opens an entity with its states', async ({ page }) => {
  const request = page.request;
  const [ws] = await (await request.get('/workspaces')).json();
  const types = await (await request.get(`/workspaces/${ws.name}/types`)).json();
  const domain = types.types[0];
  test.skip(!domain, 'no entities');
  await page.getByText('Explorer', { exact: true }).first().click();
  await page.getByText(domain.name, { exact: true }).first().click();
  await page.getByText(domain.children[0].name, { exact: true }).first().click();
  await page.getByText(domain.children[0].entities[0].title, { exact: true }).first().click();
  await expect(page.getByText(/Unverified|Verified/).first()).toBeVisible();
});

test('settings choose the model runs start on', async ({ page }) => {
  await page.getByText('Settings', { exact: true }).first().click();
  await expect(page.getByText('Models', { exact: true })).toBeVisible();
  for (const mode of ['One model', 'Per automation', 'By risk']) {
    await expect(page.getByRole('radio', { name: mode })).toBeVisible();
  }
});
