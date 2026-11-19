import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, mount, q, qa } from '../../test/render';
import { AppSkeleton, Skeleton } from './Skeleton';

afterEach(cleanup);

describe('Skeleton', () => {
  it('is a grey block that screen readers skip', () => {
    mount(<Skeleton className="h-4 w-10" />);
    const el = q('[data-skeleton]')!;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('h-4 w-10');
    expect(el.className).toContain('animate-skeleton');
  });
});

describe('AppSkeleton', () => {
  it('tells screen readers what is loading, as a status, and shows the logo', () => {
    mount(<AppSkeleton label="Loading the workspace" />);
    const status = q('[role="status"]')!;
    expect(status.textContent).toContain('Loading the workspace');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(q('svg[aria-label="Liraspaces"]')).not.toBeNull();
  });

  it('has the shape of the app: a top bar, a sidebar and four board columns of grey blocks', () => {
    mount(<AppSkeleton label="x" />);
    expect(qa('[data-skeleton]').length).toBeGreaterThan(20);
    expect(qa('[data-skeleton].rounded-md')).toHaveLength(3 + 2 + 3 + 1); // the cards: 3, 2, 3 and 1 per column
  });
});

describe('the skeleton animation', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');

  it('is defined, and stands still for people who ask for less motion', () => {
    expect(css).toContain('@keyframes skeleton');
    expect(css).toMatch(/\.animate-skeleton\s*\{/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.animate-skeleton[^}]*animation:\s*none/s);
  });
});
