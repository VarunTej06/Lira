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
  await board.locator('g[data-shape-id]', { hasText: 'First idea' }).click();
  await board.locator('g[data-shape-id]', { hasText: 'Second idea' }).click();
  await expect(board.locator('g[data-link-id] polygon')).toHaveCount(1);

  // bold from the keys
  await board.locator('g[data-shape-id]', { hasText: 'First idea' }).click();
  await page.keyboard.press('Control+b');
  await expect(board.locator('g[data-shape-id] text', { hasText: 'First idea' })).toHaveAttribute('font-weight', '700');

  // a comment on a shape, edited afterwards
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await board.locator('g[data-shape-id]', { hasText: 'Second idea' }).click();
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
  await board.locator('g[data-shape-id]', { hasText: 'Notes 1' }).dblclick();
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

test('a storyboard: shapes, ideas and lines can be moved, resized and bent, and Tidy up puts the ideas back', async ({ page }, info) => {
  const board = await open(page, 'Arrange');
  const surface = board.locator('svg.touch-none');
  const place = async (tool: string, x: number, y: number, text: string) => {
    await page.getByRole('button', { name: tool, exact: true }).click();
    await surface.click({ position: { x, y } });
    await page.getByLabel('Text of the shape').fill(text);
    await page.getByLabel('Text of the shape').press('Control+Enter');
  };
  await place('Box', 260, 140, 'Box A');
  await place('Ellipse', 620, 140, 'Ellipse B');
  const shape = (text: string) => board.locator('g[data-shape-id]', { hasText: text });
  const box = async (loc: ReturnType<typeof shape>) => (await loc.locator('rect:not([data-resize]), ellipse').first().boundingBox())!;
  const dragBy = async (from: { x: number; y: number }, dx: number, dy: number) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 }); await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 }); await page.mouse.up();
  };

  // a shape moves with the mouse
  const a0 = await box(shape('Box A'));
  await dragBy({ x: a0.x + a0.width / 2, y: a0.y + a0.height / 2 }, 90, 120);
  const a1 = await box(shape('Box A'));
  expect(Math.round(a1.x - a0.x)).toBe(90);
  expect(Math.round(a1.y - a0.y)).toBe(120);

  // and resizes from a corner and from a side
  await shape('Box A').click();
  await expect(board.locator('rect[data-resize]')).toHaveCount(8);
  const corner = (await board.locator('rect[data-resize="1,1"]').boundingBox())!;
  await dragBy({ x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, 60, 40);
  const a2 = await box(shape('Box A'));
  expect(Math.round(a2.width - a1.width)).toBeGreaterThanOrEqual(58);
  expect(Math.round(a2.height - a1.height)).toBeGreaterThanOrEqual(38);
  const side = (await board.locator('rect[data-resize="-1,0"]').boundingBox())!;
  await dragBy({ x: side.x + side.width / 2, y: side.y + side.height / 2 }, -50, 0);
  const a3 = await box(shape('Box A'));
  expect(Math.round(a3.width - a2.width)).toBeGreaterThanOrEqual(48);
  expect(Math.round(a3.x + a3.width)).toBe(Math.round(a2.x + a2.width)); // the other side did not move

  // an arrow between them, then bent by its middle dot
  await page.getByRole('button', { name: 'Arrow', exact: true }).click();
  await shape('Box A').click();
  await shape('Ellipse B').click();
  const line = board.locator('g[data-link-id]');
  await expect(line).toHaveCount(1);
  await line.locator('path').nth(1).click({ force: true });
  const path = () => line.locator('path').nth(1).getAttribute('d');
  expect(await path()).not.toContain('Q');
  const mid = (await board.locator('[data-link-handle="bend"]').boundingBox())!;
  await dragBy({ x: mid.x + mid.width / 2, y: mid.y + mid.height / 2 }, 0, -140);
  expect(await path()).toContain('Q');
  await page.screenshot({ path: info.outputPath('storyboard-bent.png') });
  const bent = (await board.locator('[data-link-handle="bend"]').boundingBox())!;
  await page.mouse.dblclick(bent.x + bent.width / 2, bent.y + bent.height / 2);
  expect(await path()).not.toContain('Q');

  // an end of the line is pulled into empty space, which makes the line longer
  const end = (await board.locator('[data-link-handle="to"]').boundingBox())!;
  await dragBy({ x: end.x + end.width / 2, y: end.y + end.height / 2 }, 40, 260);
  await expect(line).toHaveCount(1);
  const free = (await board.locator('[data-link-handle="to"]').boundingBox())!;
  expect(Math.round(free.y - end.y)).toBeGreaterThan(200);

  // an idea moves too, and Tidy up puts it back
  const root = board.locator('g[data-node-id]').first();
  await root.click();
  const r0 = (await root.boundingBox())!;
  await expect(page.getByRole('button', { name: 'Tidy up the ideas' })).toBeDisabled();
  await dragBy({ x: r0.x + r0.width / 2, y: r0.y + r0.height / 2 }, 0, 150);
  const r1 = (await root.boundingBox())!;
  expect(Math.round(r1.y - r0.y)).toBe(150);
  await page.getByRole('button', { name: 'Tidy up the ideas' }).click();
  const r2 = (await root.boundingBox())!;
  expect(Math.round(r2.y - r0.y)).toBe(0);

  await page.reload();
  const again = page.getByRole('application', { name: 'Storyboard' });
  expect(Math.round((await again.locator('g[data-shape-id]', { hasText: 'Box A' }).boundingBox())!.width)).toBeGreaterThan(Math.round(a1.width));
});
