import { expect, test } from '@playwright/test';

test('a dialog closes on Cancel, on Escape and on Delete, and Delete really deletes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
  await page.goto('/storyboxes');
  await page.getByRole('button', { name: 'New story box' }).click();
  await page.getByLabel('Name').fill('To delete');
  await page.getByLabel('Time to vote on each ticket').selectOption('3');
  await page.getByRole('button', { name: 'Make the box' }).click();
  const dialog = page.getByRole('dialog');

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'To delete' })).toBeVisible(); // nothing was deleted

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/storyboxes$/);
  await expect(page.getByRole('region', { name: 'Current story boxes' })).not.toContainText('To delete');
});
