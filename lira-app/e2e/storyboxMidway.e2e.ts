import { expect, test } from '@playwright/test';

test('a story box: participants show before a ticket, a ticket can be put back, the time can be changed, and leaving mid-vote asks first', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
  await page.goto('/storyboxes');
  await page.getByRole('button', { name: 'New story box' }).first().click();
  await page.getByLabel('Name').fill('Midway');
  await page.locator('#sb-space').selectOption({ label: 'Lira' });
  await page.getByLabel('Time to vote on each ticket').selectOption('3');
  await page.getByRole('button', { name: 'Make the box' }).click();
  await expect(page).toHaveURL(/\/storyboxes\/.+/);

  // before any ticket is put up
  const people = page.getByRole('region', { name: 'Participants' });
  await expect(people).toContainText('Voting starts when a ticket is put up');
  await expect(people).toContainText('Ready');

  // the time can be changed with the pencil
  await page.getByRole('button', { name: 'Change the time to vote' }).click();
  await page.getByLabel('Time to vote on each ticket').selectOption('7');
  await page.getByRole('button', { name: 'Save the time' }).click();
  await expect(page.getByText('7 min', { exact: true })).toBeVisible();

  // put a ticket up, then change your mind
  await page.getByRole('button', { name: /Start voting on/ }).first().click();
  const stage = page.getByRole('region', { name: 'Estimation window' });
  await expect(stage.getByRole('timer')).toContainText(/0[67]:\d\d/);
  await page.screenshot({ path: info.outputPath('storybox-midway.png') });
  await stage.getByRole('button', { name: 'Put the ticket back' }).click();
  await expect(stage).toHaveCount(1);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: /Start voting on/ }).nth(1).click();
  await expect(page.getByRole('timer')).toBeVisible();

  // leaving from the sidebar asks first
  await page.getByText('Storyboards', { exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Leave this page?');
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/storyboxes\/.+/);
  await page.keyboard.press('Escape'); // nothing to close, and nothing breaks
  await page.getByText('Storyboards', { exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/mindmaps$/);
});
