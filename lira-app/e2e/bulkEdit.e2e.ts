import { expect, test } from '@playwright/test';

test('bulk edit: tick tickets, change their priority, then undo', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
  await page.goto('/filters');
  await expect(page.getByRole('region', { name: 'Change the selected tickets' })).toHaveCount(0);

  const rows = page.locator('tbody tr');
  const key = (await rows.nth(0).locator('td').nth(1).innerText()).trim();
  const mine = page.locator('tbody tr', { hasText: key }).first(); // the table is sorted by update time, so a ticket moves when it changes
  const before = await mine.locator('td').nth(5).innerText();
  await page.getByRole('checkbox', { name: 'Select all shown' }).check();
  const bar = page.getByRole('region', { name: 'Change the selected tickets' });
  await expect(bar).toContainText('selected');
  await expect(bar.getByRole('button', { name: 'Apply' })).toBeDisabled();

  await bar.getByLabel('Set priority').selectOption('highest');
  await page.screenshot({ path: info.outputPath('bulk-edit.png') });
  await bar.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('status')).toContainText('Updated');
  await expect(mine.locator('td').nth(5)).toContainText(/highest/i);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status')).toContainText('back');
  await expect(mine.locator('td').nth(5)).toHaveText(before);
});
