import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q } from '../../test/render';
import { fitView, MAX_K, MIN_K, useMindView, zoomView } from './useMindView';

afterEach(cleanup);

describe('fitting the map in the panel', () => {
  it('centres the map and zooms out to fit, but never zooms in past 100 percent', () => {
    const big = fitView({ x: -500, y: -200, w: 1000, h: 400 }, { w: 692, h: 500 });
    expect(big.k).toBeCloseTo(0.5, 5);
    expect(big.x).toBeCloseTo(0, 5); // the map is centred on the origin
    const small = fitView({ x: -50, y: -20, w: 100, h: 40 }, { w: 1200, h: 800 });
    expect(small.k).toBe(1);
  });
  it('keeps the zoom within its limits and shifts to keep the middle of the map in the middle', () => {
    const tiny = fitView({ x: 0, y: 0, w: 100000, h: 100000 }, { w: 800, h: 600 });
    expect(tiny.k).toBe(MIN_K);
    const off = fitView({ x: 100, y: 50, w: 200, h: 100 }, { w: 1200, h: 800 });
    expect(off.x).toBeCloseTo(-200, 5);
    expect(off.y).toBeCloseTo(-100, 5);
  });
  it('is the plain view for an empty map or a panel not measured yet', () => {
    expect(fitView({ x: 0, y: 0, w: 0, h: 0 }, { w: 800, h: 600 })).toEqual({ x: 0, y: 0, k: 1 });
    expect(fitView({ x: 0, y: 0, w: 100, h: 100 }, { w: 0, h: 0 })).toEqual({ x: 0, y: 0, k: 1 });
  });
});

describe('zooming', () => {
  it('keeps the point under the pointer where it is', () => {
    const v = zoomView({ x: 10, y: 20, k: 1 }, 2, 100, 50);
    expect(v.k).toBe(2);
    expect((100 - v.x) / v.k).toBeCloseTo((100 - 10) / 1, 5);
    expect((50 - v.y) / v.k).toBeCloseTo((50 - 20) / 1, 5);
  });
  it('stops at the smallest and the largest zoom', () => {
    expect(zoomView({ x: 0, y: 0, k: 1 }, 1000).k).toBe(MAX_K);
    expect(zoomView({ x: 0, y: 0, k: 1 }, 0.0001).k).toBe(MIN_K);
  });
});

function Probe() {
  const { view, zoomBy, fit, reset } = useMindView();
  return (
    <div>
      <p id="view">{view.k.toFixed(2)}|{Math.round(view.x)}|{Math.round(view.y)}</p>
      <button id="in" onClick={() => zoomBy(2)} />
      <button id="fit" onClick={() => fit({ x: -400, y: -100, w: 800, h: 200 }, { w: 592, h: 400 })} />
      <button id="reset" onClick={reset} />
    </div>
  );
}
const click = async (sel: string) => { await act(async () => { q<HTMLButtonElement>(sel)!.click(); }); };

describe('the view of the drawing', () => {
  it('starts at 100 percent in the middle, zooms, fits, and goes back', async () => {
    mount(<Probe />);
    expect(q('#view')!.textContent).toBe('1.00|0|0');
    await click('#in');
    expect(q('#view')!.textContent).toBe('2.00|0|0');
    await click('#fit');
    expect(q('#view')!.textContent).toBe('0.50|0|0');
    await click('#reset');
    expect(q('#view')!.textContent).toBe('1.00|0|0');
  });
});
