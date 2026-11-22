import { afterEach, describe, expect, it, vi } from 'vitest';
import { goTo } from './navigate';

afterEach(() => vi.unstubAllGlobals());

describe('goTo', () => {
  it('opens the address with a full page load', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    goTo('/app');
    expect(assign).toHaveBeenCalledWith('/app');
  });
});
