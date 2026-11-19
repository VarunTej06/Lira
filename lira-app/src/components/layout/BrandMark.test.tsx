import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount, q } from '../../test/render';
import { BrandMark } from './BrandMark';

afterEach(cleanup);

describe('BrandMark', () => {
  it('is the logo and the name, and not a link, in the local edition', () => {
    mount(<BrandMark edition="local" />);
    expect(q('svg[aria-label="Liraspaces"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Liraspaces');
    expect(q('a')).toBeNull();
  });

  it('leads to the coming-soon page in the hosted edition', () => {
    mount(<BrandMark edition="hosted" />);
    expect(q('a')!.getAttribute('href')).toBe('/coming-soon');
  });
});
