import { expect, test } from '@playwright/test';

test('saved filters: choose, save under a name, clear, apply it again, reload, delete', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
  await page.goto('/filters');
  const saved = page.getByRole('region', { name: 'Saved filters' });
  await expect(saved).toContainText('None yet');
  await expect(saved.getByRole('button', { name: 'Save current filter' })).toBeDisabled();

  const total = await page.locator('tbody tr').count();
  await page.getByPlaceholder(/Search key/).fill('kubernetes');
  await expect(saved.getByRole('button', { name: 'Save current filter' })).toBeEnabled();
  const matching = await page.locator('tbody tr').count();
  expect(matching).toBeGreaterThan(0);
  expect(matching).toBeLessThan(total);

  await saved.getByRole('button', { name: 'Save current filter' }).click();
  await saved.getByLabel('Name for this filter').fill('Kubernetes work');
  await saved.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(saved.getByRole('button', { name: 'Kubernetes work', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(saved.getByRole('button', { name: 'Save current filter' })).toBeDisabled(); // already saved
  await page.screenshot({ path: info.outputPath('saved-filters.png') });

  await page.getByRole('button', { name: /clear/i }).first().click().catch(() => undefined);
  await page.getByPlaceholder(/Search key/).fill('');
  await expect(saved.getByRole('button', { name: 'Kubernetes work', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('tbody tr')).toHaveCount(total);

  await saved.getByRole('button', { name: 'Kubernetes work', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(matching);
  await expect(page.getByPlaceholder(/Search key/)).toHaveValue('kubernetes');

  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved filters' }).getByRole('button', { name: 'Kubernetes work', exact: true })).toBeVisible(); // kept

  await page.getByRole('button', { name: 'Delete saved filter Kubernetes work' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved filters' })).toContainText('None yet');
});
