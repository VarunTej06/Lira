import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
});

async function open(page: Page, name: string, template?: string) {
  await page.goto('/mindmaps');
  await page.getByRole('button', { name: 'New storyboard' }).first().click();
  await page.getByLabel('Name').fill(name);
  if (template) await page.getByText(template, { exact: true }).click();
  await page.getByRole('button', { name: 'Make the storyboard' }).click();
  await expect(page).toHaveURL(/\/mindmaps\/.+/);
  return page.getByRole('application', { name: 'Storyboard' });
}

test('a storyboard: a pinch zooms only the board, never the page', async ({ page }) => {
  const board = await open(page, 'Zoom test');
  await page.evaluate(() => {
    const w = window as unknown as { __prevented: boolean[] };
    w.__prevented = [];
    document.addEventListener('wheel', e => w.__prevented.push(e.defaultPrevented)); // runs after the board's own handler
  });
  const box = (await board.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveText('100%');
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120); // a pinch arrives as a wheel turn with Ctrl held
  await page.keyboard.up('Control');
  await expect.poll(async () => parseInt((await page.getByLabel('Zoom', { exact: true }).innerText()).replace('%', ''), 10)).toBeGreaterThan(100);
  expect(await page.evaluate(() => (window as unknown as { __prevented: boolean[] }).__prevented.every(Boolean))).toBe(true);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1); // the page itself is not zoomed
});

test('a storyboard: draw boxes and an arrow, write bold text, leave a comment, and find it all after a reload', async ({ page }, info) => {
  const board = await open(page, 'Drawing');
  const place = async (tool: string, x: number, y: number, text: string) => {
    await page.getByRole('button', { name: tool, exact: true }).click();
    await board.locator('svg.touch-none').click({ position: { x, y } });
    await page.getByLabel('Text of the shape').fill(text);
    await page.getByLabel('Text of the shape').press('Control+Enter');
  };
  await place('Box', 220, 120, 'First idea');
  await place('Ellipse', 520, 120, 'Second idea');
  await place('Sticky note', 380, 420, 'Remember this');
  await expect(board.getByText('First idea')).toBeVisible();

  // join two shapes with an arrow
  await page.getByRole('button', { name: 'Arrow', exact: true }).click();
  await board.getByText('First idea').click();
  await board.getByText('Second idea').click();
  await expect(board.locator('g[data-link-id] polygon')).toHaveCount(1);

  // bold from the keys
  await board.getByText('First idea').click();
  await page.keyboard.press('Control+b');
  await expect(board.locator('g[data-shape-id] text', { hasText: 'First idea' })).toHaveAttribute('font-weight', '700');

  // a comment on a shape, edited afterwards
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await board.getByText('Second idea').click();
  await page.getByLabel('Write a comment').fill('Is this the right name?');
  await page.getByRole('form', { name: 'New comment' }).getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Comment' })).toContainText('Is this the right name?');
  await page.getByRole('button', { name: 'Edit the comment text' }).click();
  await page.getByLabel('Edit the comment').fill('Better name needed');
  await page.getByRole('region', { name: 'Comment' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Comment' })).toContainText('(edited)');
  await page.screenshot({ path: info.outputPath('storyboard-drawing.png') });

  await page.reload();
  const again = page.getByRole('application', { name: 'Storyboard' });
  await expect(again.locator('g[data-shape-id] text', { hasText: 'First idea' })).toHaveAttribute('font-weight', '700');
  await expect(again.locator('g[data-link-id]')).toHaveCount(1);
  await expect(again.locator('g[data-comment-id]')).toHaveCount(1);
});

test('storyboard templates are different boards: meeting notes are sticky notes with a small map of decisions', async ({ page }, info) => {
  const board = await open(page, 'Weekly sync', 'Meeting notes');
  await page.getByRole('button', { name: 'Fit to screen' }).click();
  await expect(board.getByText('Agenda', { exact: true })).toBeVisible();
  expect(await board.locator('g[data-shape-id]').count()).toBeGreaterThan(8);
  await expect(board.locator('g[data-node-id]', { hasText: 'Decision 1' })).toBeVisible(); // the map of decisions
  await page.screenshot({ path: info.outputPath('storyboard-meeting.png') });

  // the notes can be edited and more can be added
  await board.getByText('Notes 1').dblclick();
  await page.getByLabel('Text of the shape').fill('We agreed to ship on Friday');
  await page.getByLabel('Text of the shape').press('Control+Enter');
  await expect(board.getByText('We agreed to ship', { exact: false }).first()).toBeVisible(); // long words wrap onto lines
  const before = await board.locator('g[data-shape-id]').count();
  await page.getByRole('button', { name: 'Sticky note', exact: true }).click();
  await board.locator('svg.touch-none').click({ position: { x: 300, y: 500 } });
  await page.getByLabel('Text of the shape').press('Escape');
  await expect(board.locator('g[data-shape-id]')).toHaveCount(before + 1);
  // and a decision can be added to the map
  await board.locator('g[data-node-id]', { hasText: 'Decision 1' }).click();
  await page.getByRole('button', { name: 'Add an idea under this one' }).click();
  await expect(page.getByLabel('Idea text')).toBeVisible(); // the new idea is open for typing
});
