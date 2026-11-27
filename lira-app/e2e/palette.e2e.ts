import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
});

test('the command palette: Ctrl+K, search a page, a ticket by key, and go there with the keyboard', async ({ page }, info) => {
  await page.goto('/for-you');
  await page.waitForTimeout(2500); // the palette is fetched quietly 1.5 seconds after start-up
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await expect(dialog.getByRole('group', { name: 'Go to' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('palette-empty.png') });

  await page.keyboard.type('mind');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/mindmaps/);
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('set up personal');
  const ticket = dialog.getByRole('group', { name: 'Tickets' }).getByRole('option').first();
  await expect(ticket).toContainText('Set up personal homelab');
  await page.screenshot({ path: info.outputPath('palette-ticket.png') });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/issue=/); // the ticket popup opened
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Child issues').first()).toBeVisible(); // the popup is fully open before it is closed
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/issue=/);
  await page.keyboard.press('Control+k');
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('qqqqqq');
  await expect(dialog.getByRole('status')).toContainText('Nothing matches');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
