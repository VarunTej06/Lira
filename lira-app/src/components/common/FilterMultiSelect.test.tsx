import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { FilterMultiSelect } from './FilterMultiSelect';
import { byText, cleanup, click, mount, press, q, qa, settle, typeInto, wait } from '../../test/render';

afterEach(cleanup);

const OPTIONS = [
  { value: 'highest', label: 'Highest', color: '#f00' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
];

const open = async (props: Partial<React.ComponentProps<typeof FilterMultiSelect>> = {}) => {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  mount(<FilterMultiSelect label="Priority" options={OPTIONS} selected={[]} onToggle={onToggle} onClear={onClear} {...props} />);
  await click(q('[data-testid=filter-priority]'));
  await settle();
  return { onToggle, onClear };
};

describe('FilterMultiSelect', () => {
  it('shows only the button until it is pressed, then a checkbox for every value', async () => {
    mount(<FilterMultiSelect label="Priority" options={OPTIONS} selected={[]} onToggle={() => {}} />);
    expect(q('[aria-label="Priority filter"]')).toBeNull();
    await click(q('[data-testid=filter-priority]'));
    await settle();
    expect(qa('[aria-label="Priority filter"] input[type=checkbox]')).toHaveLength(3);
  });

  it('ticks the chosen values and shows how many are chosen', async () => {
    await open({ selected: ['high', 'low'] });
    const boxes = qa<HTMLInputElement>('[aria-label="Priority filter"] input[type=checkbox]');
    expect(boxes.map(b => b.checked)).toEqual([false, true, true]);
    expect(q('[data-testid=filter-priority]')!.textContent).toContain('2');
  });

  it('reports the value that was ticked, and several can be ticked one after the other', async () => {
    const { onToggle } = await open();
    await click(qa('[aria-label="Priority filter"] input[type=checkbox]')[0]);
    await click(qa('[aria-label="Priority filter"] input[type=checkbox]')[2]);
    expect(onToggle.mock.calls.map(c => c[0])).toEqual(['highest', 'low']);
    expect(q('[aria-label="Priority filter"]')).not.toBeNull(); // still open
  });

  it('can search the values by typing', async () => {
    await open({ searchable: true, searchPlaceholder: 'Search priorities' });
    await typeInto(q<HTMLInputElement>('[aria-label="Search priorities"]'), 'hig');
    expect(qa('[aria-label="Priority filter"] label').map(l => l.textContent?.trim())).toEqual(['Highest', 'High']);
    await typeInto(q<HTMLInputElement>('[aria-label="Search priorities"]'), 'zzz');
    expect(q('[aria-label="Priority filter"]')!.textContent).toContain('No match');
  });

  it('offers to clear its own values', async () => {
    const { onClear } = await open({ selected: ['low'] });
    await click(byText('button', /Clear priority/i));
    expect(onClear).toHaveBeenCalled();
  });

  it('closes on Escape and when the page behind it is scrolled', async () => {
    await open();
    await press('Escape');
    await settle(250);
    expect(q('[aria-label="Priority filter"]')).toBeNull();
    await click(q('[data-testid=filter-priority]'));
    await settle();
    await act(async () => { document.dispatchEvent(new Event('scroll')); await wait(0); });
    await settle(250);
    expect(q('[aria-label="Priority filter"]')).toBeNull();
  });

  it('stays open when its own list is scrolled', async () => {
    await open();
    const list = q('[aria-label="Priority filter"] ul')!;
    await act(async () => { list.dispatchEvent(new Event('scroll')); await wait(0); });
    await settle(250);
    expect(q('[aria-label="Priority filter"]')).not.toBeNull();
  });

  it('single choice: radio buttons, and choosing closes it', async () => {
    const onToggle = vi.fn();
    mount(<FilterMultiSelect single label="Sprint" valueLabel="Current" options={OPTIONS} selected={['low']} onToggle={onToggle} />);
    await click(q('[data-testid=filter-sprint]'));
    await settle();
    expect(q('[data-testid=filter-sprint]')!.textContent).toContain('Sprint: Current');
    expect(qa('[aria-label="Sprint filter"] input[type=radio]')).toHaveLength(3);
    await click(qa('[aria-label="Sprint filter"] input[type=radio]')[0]);
    await settle(250);
    expect(onToggle).toHaveBeenCalledWith('highest');
    expect(q('[aria-label="Sprint filter"]')).toBeNull();
  });

  it('says so when there is nothing to choose', async () => {
    await open({ options: [], emptyText: 'No labels yet' });
    expect(q('[aria-label="Priority filter"]')!.textContent).toContain('No labels yet');
  });

  it('is highlighted only while a filter is set', async () => {
    mount(<FilterMultiSelect single active={false} label="Period" valueLabel="All time" options={OPTIONS} selected={['x']} onToggle={() => {}} />);
    expect(q('[data-testid=filter-period]')!.className).not.toContain('border-lira-blue');
  });
});
