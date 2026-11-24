import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * An automatic accessibility scan (WCAG 2 A and AA rules) of every page. A page may not have a critical problem. The number of serious
 * ones may only go down: the limits below are today's, and a fix lowers its limit in the same change.
 */
const PAGES = ['/for-you', '/projects', '/sprints', '/tickets', '/roadmaps', '/dashboards', '/mindmaps', '/storyboxes', '/filters'];
/** Left to fix: the roadmaps page (a small count chip with low contrast, and a card that is a button holding another button) and one contrast problem on the filters page. */
const SERIOUS_LIMIT: Record<string, number> = { '/roadmaps': 2, '/filters': 1 };

for (const path of PAGES) {
  test(`${path} has no critical accessibility problems`, async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
    await page.goto(path);
    await page.waitForTimeout(700);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const summary = result.violations.map(v => `${v.impact} ${v.id} (${v.nodes.length})`);
    await info.attach('violations', { body: summary.join('\n') || 'none', contentType: 'text/plain' });
    console.log(`${path}: ${summary.join(', ') || 'none'}`);
    expect(result.violations.filter(v => v.impact === 'critical').map(v => v.id), 'critical').toEqual([]);
    const serious = result.violations.filter(v => v.impact === 'serious').length;
    expect(serious, `serious problems (limit ${SERIOUS_LIMIT[path] ?? 0})`).toBeLessThanOrEqual(SERIOUS_LIMIT[path] ?? 0);
  });
}
