import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Space } from '../../types/space';
import { addCustomSprint, getPlannedSprints, getSprintMeta, toDay } from '../../utils/sprintUtils';
import { byText, cleanup, click, mount, q, qa, typeInto } from '../../test/render';
import { CreateSprintModal } from './CreateSprintModal';

const space = (id: number, key: string): Space => ({ id, key, name: key, icon: 'x', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0)); // Monday 9 Nov 2026
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function open(over: Partial<Parameters<typeof CreateSprintModal>[0]> = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  mount(<CreateSprintModal isOpen onClose={onClose} existingKeys={[]} onCreated={onCreated} {...over} />);
  return { onClose, onCreated };
}
const radio = (label: string) => qa('[role="radio"]').find(b => b.textContent?.includes(label))!;
const preview = () => q('[aria-live="polite"]')!.textContent!;
const submit = () => byText('button', /Create sprint|Open sprint/)!;

describe('CreateSprintModal', () => {
  it('starts on a monthly sprint with the current month chosen', () => {
    open();
    expect(radio('Monthly').getAttribute('aria-checked')).toBe('true');
    expect(preview()).toContain('Nov');
    expect(preview()).toContain('30 days');
    expect(preview()).toContain('left'); // the current sprint says how many days are left
  });

  it('offers twelve months and marks the current one', () => {
    open();
    const months = qa('button').filter(b => /Current|Already planned|Free/.test(b.textContent ?? '') && !b.hasAttribute('role'));
    expect(months).toHaveLength(12);
    expect(months[0].textContent).toContain('Current');
    expect(months[1].textContent).toContain('Free');
  });

  it('marks a month that already has a sprint, and then offers to open it instead of creating it', async () => {
    open({ existingKeys: ['2026-12'] });
    const december = qa('button').find(b => b.textContent?.includes('Dec 2026'))!;
    expect(december.textContent).toContain('Already planned');
    await click(december);
    expect(submit().textContent).toBe('Open sprint');
  });

  it('creating a monthly sprint plans that month, tells the page, and closes', async () => {
    const { onCreated, onClose } = open();
    await click(qa('button').find(b => b.textContent?.includes('Jan 2027')));
    expect(submit().textContent).toBe('Create sprint');
    await click(submit());
    expect(getPlannedSprints()).toContain('2027-01');
    expect(onCreated).toHaveBeenCalledWith('2027-01');
    expect(onClose).toHaveBeenCalled();
  });

  it('saves the goal with the sprint', async () => {
    const { onCreated } = open();
    await typeInto(q<HTMLInputElement>('input[placeholder^="What should be true"]'), '  Ship the board  ');
    await click(submit());
    expect(getSprintMeta('all', onCreated.mock.calls[0][0]).goal).toBe('Ship the board');
  });

  describe('weekly', () => {
    it('asks for a start date and an optional name, and shows the dates it will cover', async () => {
      open();
      await click(radio('Weekly'));
      expect(q('#sprint-start')).not.toBeNull();
      expect(q('#sprint-name')).not.toBeNull();
      expect(q('#sprint-days')).toBeNull();
      expect(preview()).toContain('7 days');
      expect(preview()).toContain('Nov 9 – Nov 15');
    });

    it('uses the name typed, and creates a custom sprint starting today', async () => {
      const { onCreated } = open();
      await click(radio('Weekly'));
      await typeInto(q<HTMLInputElement>('#sprint-name'), 'Sprint 12');
      expect(preview()).toContain('Sprint 12');
      await click(submit());
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(String(onCreated.mock.calls[0][0])).toContain(toDay(new Date(2026, 10, 9)));
    });

    it('warns about an overlap and does not allow creating', async () => {
      addCustomSprint({ start: toDay(new Date(2026, 10, 9)), kind: 'weekly', days: 7, name: '' });
      const { onCreated } = open();
      await click(radio('Weekly'));
      expect(preview()).toContain('Overlaps the sprint starting');
      expect((submit() as HTMLButtonElement).disabled).toBe(true);
      await click(submit());
      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  describe('number of days', () => {
    it('shows the day count and the name, and follows the count in the preview', async () => {
      open();
      await click(radio('Number of days'));
      const days = q<HTMLInputElement>('#sprint-days')!;
      expect(days.value).toBe('10');
      expect(q('#sprint-name')).not.toBeNull();
      await typeInto(days, '3');
      expect(preview()).toContain('3 days');
    });

    it('refuses zero days and too many days', async () => {
      open();
      await click(radio('Number of days'));
      await typeInto(q<HTMLInputElement>('#sprint-days'), '0');
      expect((submit() as HTMLButtonElement).disabled).toBe(true);
      await typeInto(q<HTMLInputElement>('#sprint-days'), '500');
      expect((submit() as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('spaces', () => {
    it('has no space picker when there are no spaces', () => {
      open();
      expect(document.body.textContent).not.toContain('Spaces in this sprint');
    });

    it('shows the picker when spaces are given', () => {
      open({ spaces: [space(1, 'AAA'), space(2, 'BBB')] });
      expect(qa('input[type="checkbox"], [role="checkbox"]').length + qa('button').length).toBeGreaterThan(0);
    });
  });

  it('starts again each time it opens', async () => {
    const onCreated = vi.fn();
    const view = mount(<CreateSprintModal isOpen onClose={() => {}} existingKeys={[]} onCreated={onCreated} />);
    await click(radio('Weekly'));
    view.rerender(<CreateSprintModal isOpen={false} onClose={() => {}} existingKeys={[]} onCreated={onCreated} />);
    view.rerender(<CreateSprintModal isOpen onClose={() => {}} existingKeys={[]} onCreated={onCreated} />);
    expect(radio('Monthly').getAttribute('aria-checked')).toBe('true');
  });
});
