import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

  it('leads to For you, inside the app, in the hosted edition: never out to the public pages', () => {
    mount(<MemoryRouter initialEntries={['/projects']}><BrandMark edition="hosted" /><Routes><Route path="*" element={null} /></Routes></MemoryRouter>);
    expect(q('a')!.getAttribute('href')).toBe('/for-you');
    expect(q('a')!.getAttribute('href')).not.toContain('coming-soon');
  });
});
