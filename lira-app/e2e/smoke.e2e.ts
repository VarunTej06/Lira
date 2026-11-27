import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/** Everything a page logs as an error or throws, so a page that "loads" but is broken still fails. */
function watch(page: Page): () => string[] {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`error: ${e.message}`));
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
  return () => problems;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
});

test('a first start on an empty data folder shows each sample space once (found by this test: it showed them twice)', async ({ page }) => {
  await page.goto('/');
  const sample = page.locator('aside').getByText(/^(General Tasks|Creator Hub|Certifications|Courses)$/);
  await expect(sample.first()).toBeVisible();
  const names = await sample.allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  expect(new Set(names).size).toBe(names.length);
});

test('the app opens on a board with the navigation and the two new pages in it', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Storyboards' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Story boxes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dashboards' })).toBeVisible();
  expect(problems()).toEqual([]);
});

const PAGES: [string, string | RegExp][] = [
  ['/for-you', 'For you'], ['/projects', 'Projects'], ['/sprints', 'Sprints'], ['/tickets', 'All tickets'], ['/roadmaps', 'Roadmaps'],
  ['/dashboards', 'Dashboards'], ['/mindmaps', 'New storyboard'], ['/storyboxes', 'Story boxes'], ['/filters', 'Filters'],
];
for (const [path, marker] of PAGES) {
  test(`${path} opens without errors`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(path);
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(problems()).toEqual([]);
  });
}
