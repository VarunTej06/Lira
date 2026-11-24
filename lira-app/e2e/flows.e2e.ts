import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
});

test('a mind map: make one, add ideas with the keyboard, undo, reload, and export it', async ({ page }, info) => {
  await page.goto('/mindmaps');
  await page.locator('nav[aria-label="Mind maps"] > button').first().click();
  await expect(page).toHaveURL(/\/mindmaps\/.+/);
  const canvas = page.getByRole('application', { name: 'Mind map' });
  await expect(canvas).toBeVisible();

  await canvas.locator('g[data-node-id]').first().click();
  await page.keyboard.press('Tab');
  await page.keyboard.type('Research');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // a sibling of Research
  await page.keyboard.type('Design');
  await page.keyboard.press('Enter');
  await expect(canvas.getByText('Research')).toBeVisible();
  await expect(canvas.getByText('Design')).toBeVisible();
  await page.screenshot({ path: info.outputPath('mindmap.png') });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(canvas.getByText('Design')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(canvas.getByText('Design')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('application', { name: 'Mind map' }).getByText('Research')).toBeVisible(); // saved

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'md', exact: true }).click()]);
  expect(download.suggestedFilename()).toBe('new-mind-map.md');
  const text = readFileSync(await download.path(), 'utf8');
  expect(text).toContain('- Research');
  expect(text).toContain('- Design');
});

test('a mind map: an idea dragged onto another moves with its branch, and the central idea cannot be deleted', async ({ page }) => {
  await page.goto('/mindmaps');
  await page.locator('nav[aria-label="Mind maps"] > button').first().click();
  const canvas = page.getByRole('application', { name: 'Mind map' });
  await canvas.locator('g[data-node-id]').first().click();
  for (const name of ['One', 'Two']) { await page.keyboard.press('Tab'); await page.keyboard.type(name); await page.keyboard.press('Enter'); await canvas.locator('g[data-node-id]').first().click(); }
  const one = canvas.locator('g[data-node-id]', { hasText: 'One' });
  const two = canvas.locator('g[data-node-id]', { hasText: 'Two' });
  const [a, b] = [await one.boundingBox(), await two.boundingBox()];
  expect(a && b).toBeTruthy();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'md', exact: true }).waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'md', exact: true }).click()]);
  const outline = readFileSync(await download.path(), 'utf8');
  expect(outline).toMatch(/- Two\n {4}- One/); // One now sits under Two
  await canvas.locator('g[data-node-id]').first().click();
  await page.keyboard.press('Delete');
  await expect(canvas.locator('g[data-node-id]')).toHaveCount(3); // the central idea stayed, with One and Two
});

test('a story box: make one for a space, give points, see the votes, close it into the history', async ({ page }, info) => {
  await page.goto('/storyboxes');
  await page.getByRole('button', { name: 'New story box' }).click();
  await page.getByLabel('Name').fill('Planning');
  await page.getByRole('button', { name: 'Make the box' }).click();
  await expect(page).toHaveURL(/\/storyboxes\/.+/);
  const first = page.locator('tbody tr').first();
  await expect(first).toBeVisible();
  await first.getByRole('button', { name: '5', exact: true }).click();
  await expect(first.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toContainText('1 votes, average 5');
  await page.screenshot({ path: info.outputPath('storybox.png') });

  await page.getByRole('button', { name: 'Close the box' }).click();
  await expect(page.getByRole('status')).toContainText('This box is closed');
  await expect(first.getByRole('button', { name: '5', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Planning');
  await page.reload();
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Planning'); // kept
});
