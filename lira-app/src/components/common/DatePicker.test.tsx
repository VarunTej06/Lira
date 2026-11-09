import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';
import { byText, cleanup, click, mount, press, q, qa, settle } from '../../test/render';

afterEach(cleanup);

const trigger = () => q<HTMLButtonElement>('button[aria-haspopup=dialog]')!;
const day = (n: number) => qa<HTMLButtonElement>('[role=gridcell]').find(b => b.textContent === String(n) && !b.className.includes('text-lira-muted/60'))!;

describe('Date picker', () => {
  it('shows the chosen date in a readable form, and a placeholder when empty', () => {
    mount(<DatePicker value="2026-11-10" onChange={() => {}} />);
    expect(trigger().textContent).toContain('Nov 10, 2026');
    cleanup();
    mount(<DatePicker value="" onChange={() => {}} placeholder="No due date" />);
    expect(trigger().textContent).toContain('No due date');
  });

  it('opens a month calendar that starts on Monday', async () => {
    mount(<DatePicker value="2026-11-10" onChange={() => {}} />);
    await click(trigger());
    await settle();
    expect(q('[role=dialog][aria-label="Choose a date"]')!.textContent).toContain('November 2026');
    expect(qa('[role=dialog] .grid-cols-7')[0].textContent).toMatch(/^MoTuWeThFrSaSu/);
    expect(qa('[role=gridcell]')).toHaveLength(42);
  });

  it('picking a day returns it as YYYY-MM-DD and closes the calendar', async () => {
    const onChange = vi.fn();
    mount(<DatePicker value="2026-11-10" onChange={onChange} />);
    await click(trigger());
    await settle();
    await click(day(15));
    await settle(250);
    expect(onChange).toHaveBeenCalledWith('2026-11-15');
    expect(q('[role=dialog][aria-label="Choose a date"]')).toBeNull();
  });

  it('days outside min and max cannot be chosen', async () => {
    const onChange = vi.fn();
    mount(<DatePicker value="2026-11-10" min="2026-11-05" max="2026-11-20" onChange={onChange} />);
    await click(trigger());
    await settle();
    expect(day(3).disabled).toBe(true);
    expect(day(25).disabled).toBe(true);
    expect(day(12).disabled).toBe(false);
  });

  it('can clear the date', async () => {
    const onChange = vi.fn();
    mount(<DatePicker value="2026-11-10" onChange={onChange} />);
    await click(q('[aria-label="Clear date"]'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clicking the month and year opens a chooser that jumps to any month of any year', async () => {
    mount(<DatePicker value="2026-11-10" onChange={() => {}} />);
    await click(trigger());
    await settle();
    await click(q('[data-testid=month-year-toggle]'));
    expect(q('[data-testid=month-year-grid]')).not.toBeNull();
    await click(q('[aria-label="Next year"]'));
    await click(byText('button', 'Mar', q('[data-testid=month-year-grid]')!));
    expect(q('[data-testid=month-year-toggle]')!.textContent).toContain('March 2027');
    expect(q('[data-testid=month-year-grid]')).toBeNull();
  });

  it('Escape closes it', async () => {
    mount(<DatePicker value="2026-11-10" onChange={() => {}} />);
    await click(trigger());
    await settle();
    await press('Escape');
    await settle(250);
    expect(q('[role=dialog][aria-label="Choose a date"]')).toBeNull();
  });
});
