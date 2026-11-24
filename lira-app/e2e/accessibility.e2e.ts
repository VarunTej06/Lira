import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * An automatic accessibility scan (WCAG 2 A and AA rules) of every page. A page may not have a critical problem. The number of serious
 * ones may only go down: the limits below are today's, and a fix lowers its limit in the same change.
 */
const PAGES = ['/for-you', '/projects', '/sprints', '/tickets', '/roadmaps', '/dashboards', '/mindmaps', '/storyboxes', '/filters'];
/** Pages that still have serious problems, with how many: none now. A limit may only go down. */
const SERIOUS_LIMIT: Record<string, number> = {};

for (const path of PAGES) {
  test(`${path} has no critical accessibility problems`, async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem('lira_onboarded', 'true'));
    await page.goto(path);
    await page.waitForTimeout(700);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const summary = result.violations.map(v => `${v.impact} ${v.id} (${v.nodes.length})`);
    await info.attach('violations', { body: summary.join('\n') || 'none', contentType: 'text/plain' });
    console.log(`${path}: ${summary.join(', ') || 'none'}`);
    for (const v of result.violations.filter(x => x.impact === 'serious')) for (const n of v.nodes) console.log(`  serious ${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 140).replace(/\s+/g, ' ')}`); // where to look when a limit is to be lowered
    expect(result.violations.filter(v => v.impact === 'critical').map(v => v.id), 'critical').toEqual([]);
    const serious = result.violations.filter(v => v.impact === 'serious').length;
    expect(serious, `serious problems (limit ${SERIOUS_LIMIT[path] ?? 0})`).toBeLessThanOrEqual(SERIOUS_LIMIT[path] ?? 0);
  });
}
