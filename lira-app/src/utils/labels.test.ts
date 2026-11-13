import { describe, expect, it } from 'vitest';
import { addLabels, endLabel, inheritLabels, sameLabels } from './labels';

describe('addLabels', () => {
  it('adds what was typed, trimmed', () => {
    expect(addLabels(['aws'], '  cloud ')).toEqual(['aws', 'cloud']);
    expect(addLabels(undefined, 'aws')).toEqual(['aws']);
  });
  it('takes several at once, split at commas, and skips empty pieces', () => {
    expect(addLabels([], 'aws, cloud,,  k8s ,')).toEqual(['aws', 'cloud', 'k8s']);
    expect(addLabels(['aws'], ' , ')).toEqual(['aws']);
  });
  it('never adds the same label twice, whatever its capitals', () => {
    expect(addLabels(['AWS'], 'aws, Aws, cloud, CLOUD')).toEqual(['AWS', 'cloud']);
  });
  it('does not change the list it was given', () => {
    const before = ['aws'];
    addLabels(before, 'cloud');
    expect(before).toEqual(['aws']);
  });
});

describe('inheritLabels', () => {
  it('gives a child the labels of its parent, after its own', () => {
    expect(inheritLabels({ labels: ['mine'] }, ['aws', 'cloud'])).toEqual({ labels: ['mine', 'aws', 'cloud'], inheritedLabels: ['aws', 'cloud'] });
  });
  it('keeps a label the child already had as its own, not as inherited', () => {
    expect(inheritLabels({ labels: ['AWS'] }, ['aws', 'cloud'])).toEqual({ labels: ['AWS', 'cloud'], inheritedLabels: ['cloud'] });
  });
  it('removes an inherited label when the parent no longer has it', () => {
    const child = { labels: ['mine', 'aws', 'cloud'], inheritedLabels: ['aws', 'cloud'] };
    expect(inheritLabels(child, ['cloud'])).toEqual({ labels: ['mine', 'cloud'], inheritedLabels: ['cloud'] });
  });
  it('keeps only its own labels when there is no parent any more', () => {
    expect(inheritLabels({ labels: ['mine', 'aws'], inheritedLabels: ['aws'] }, [])).toEqual({ labels: ['mine'], inheritedLabels: [] });
  });
  it('gives the same answer when run again (nothing piles up)', () => {
    const once = inheritLabels({ labels: ['mine'] }, ['aws']);
    expect(inheritLabels(once, ['aws'])).toEqual(once);
  });
  it('ignores empty and repeated labels on the parent', () => {
    expect(inheritLabels({ labels: [] }, ['aws', ' ', 'AWS'])).toEqual({ labels: ['aws'], inheritedLabels: ['aws'] });
  });
  it('copes with a ticket that has no label lists at all', () => {
    expect(inheritLabels({}, ['aws'])).toEqual({ labels: ['aws'], inheritedLabels: ['aws'] });
  });
});

describe('sameLabels', () => {
  it('says whether inheriting changed anything', () => {
    const child = { labels: ['a', 'b'], inheritedLabels: ['b'] };
    expect(sameLabels(child, { labels: ['a', 'b'], inheritedLabels: ['b'] })).toBe(true);
    expect(sameLabels(child, { labels: ['a'], inheritedLabels: [] })).toBe(false);
    expect(sameLabels({ labels: [] }, { labels: [], inheritedLabels: [] })).toBe(true);
  });
});

describe('endLabel (Enter in a comma-separated label box)', () => {
  it('finishes the label being typed so the next one can follow', () => {
    expect(endLabel('aws')).toBe('aws, ');
    expect(endLabel('aws, cloud  ')).toBe('aws, cloud, ');
  });
  it('changes nothing when the box is empty or already ends with a comma', () => {
    expect(endLabel('')).toBe('');
    expect(endLabel('   ')).toBe('   ');
    expect(endLabel('aws, ')).toBe('aws, ');
  });
});
