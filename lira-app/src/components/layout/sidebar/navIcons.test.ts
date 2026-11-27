import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Source of the navigation items: the icons are written there, so the test reads it rather than drawing the whole sidebar. */
const source = readFileSync(join(__dirname, 'useSidebarState.tsx'), 'utf8');
const items = source.slice(source.indexOf('const navItemDefs'), source.indexOf('const isKeyVisible'));

describe('the icons of the navigation items', () => {
  it('are all drawn in the accent of the palette that is chosen, so none keeps its own colour when the palette changes', () => {
    const icons = [...items.matchAll(/icon: <(\w+) className="([^"]*)"/g)];
    expect(icons.length).toBeGreaterThanOrEqual(8); // For you, Projects, Sprints, All tickets, Roadmaps, Dashboards, Storyboards, Story boxes
    for (const [, name, classes] of icons) expect(classes, name).toContain('text-lira-nav-accent');
  });

  it('use no fixed colour from the stock scales (teal, yellow, orange and the like)', () => {
    expect(items).not.toMatch(/text-(?:teal|yellow|orange|amber|red|green|blue|emerald|rose|sky|cyan|lime|pink|violet|purple|indigo)-\d{2,3}/);
  });
});
