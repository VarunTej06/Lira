import { describe, expect, it } from 'vitest';
import { APP_BASE, appBasename, parseEdition, showsPublicSite } from './edition';

describe('edition', () => {
  it('is hosted only when the build mode says so; anything else is the local app', () => {
    expect(parseEdition('hosted')).toBe('hosted');
    for (const mode of ['development', 'production', 'local', 'HOSTED', '', undefined, null, 1]) expect(parseEdition(mode)).toBe('local');
  });

  it('never shows the public pages in the local edition, whatever the address', () => {
    for (const path of ['/', '/login', '/terms', '/app', '/for-you', '/space/LIRA/board']) expect(showsPublicSite('local', path)).toBe(false);
    expect(appBasename('local')).toBeUndefined();
  });

  it('shows the public pages in the hosted edition except inside /app', () => {
    for (const path of ['/', '/login', '/signup', '/privacy', '/coming-soon', '/applications', '/app-store']) expect(showsPublicSite('hosted', path)).toBe(true);
    for (const path of ['/app', '/app/', '/app/for-you', '/app/space/LIRA/board']) expect(showsPublicSite('hosted', path)).toBe(false);
  });

  it('keeps the app under /app in the hosted edition', () => {
    expect(appBasename('hosted')).toBe(APP_BASE);
    expect(APP_BASE).toBe('/app');
  });
});
