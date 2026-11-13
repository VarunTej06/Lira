import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makeIssue } from '../test/factories';
import { labelsUnder, propagateLabels } from './labelPropagation';

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => new Response('{}'));
  await db.issues.clear();
});
afterEach(() => vi.unstubAllGlobals());

const labelsOf = async (id: number) => { const t = await db.issues.get(id); return { labels: t!.labels, inherited: t!.inheritedLabels ?? [] }; };

/** Epic 1 -> task 2 (-> subtask 3, bug 5) and bug 4. Ticket 9 is unrelated. */
async function tree(epicLabels: string[]) {
  await db.issues.bulkAdd([
    makeIssue({ id: 1, type: 'epic', labels: epicLabels }),
    makeIssue({ id: 2, type: 'task', parentId: 1, labels: ['task-own'] }),
    makeIssue({ id: 3, type: 'subtask', parentId: 2, labels: [] }),
    makeIssue({ id: 4, type: 'bug', parentId: 1, labels: [] }),
    makeIssue({ id: 5, type: 'bug', parentId: 2, labels: ['bug-own'] }),
    makeIssue({ id: 9, type: 'task', labels: ['other'] }),
  ]);
}

describe('propagateLabels', () => {
  it('gives the labels of an epic to its tasks, their subtasks, and the bugs under either', async () => {
    await tree(['aws']);
    await propagateLabels(1);
    expect(await labelsOf(2)).toEqual({ labels: ['task-own', 'aws'], inherited: ['aws'] });
    expect(await labelsOf(3)).toEqual({ labels: ['task-own', 'aws'], inherited: ['task-own', 'aws'] });
    expect(await labelsOf(4)).toEqual({ labels: ['aws'], inherited: ['aws'] });
    expect(await labelsOf(5)).toEqual({ labels: ['bug-own', 'task-own', 'aws'], inherited: ['task-own', 'aws'] });
  });

  it('leaves the ticket itself and unrelated tickets alone', async () => {
    await tree(['aws']);
    await propagateLabels(1);
    expect(await labelsOf(1)).toEqual({ labels: ['aws'], inherited: [] });
    expect(await labelsOf(9)).toEqual({ labels: ['other'], inherited: [] });
  });

  it('starts from the ticket it is given: labels added on a task reach its subtasks and bugs, not its epic or siblings', async () => {
    await tree([]);
    await db.issues.update(2, { labels: ['task-own', 'k8s'] });
    await propagateLabels(2);
    expect((await labelsOf(3)).labels).toEqual(['task-own', 'k8s']);
    expect((await labelsOf(5)).labels).toEqual(['bug-own', 'task-own', 'k8s']);
    expect((await labelsOf(1)).labels).toEqual([]);
    expect((await labelsOf(4)).labels).toEqual([]);
  });

  it('removes a label everywhere below when it is removed from the parent, keeping labels typed on the children', async () => {
    await tree(['aws', 'cloud']);
    await propagateLabels(1);
    await db.issues.update(1, { labels: ['cloud'] });
    await propagateLabels(1);
    expect(await labelsOf(2)).toEqual({ labels: ['task-own', 'cloud'], inherited: ['cloud'] });
    expect((await labelsOf(3)).labels).toEqual(['task-own', 'cloud']);
    expect((await labelsOf(5)).labels).toEqual(['bug-own', 'task-own', 'cloud']);
  });

  it('writes only the tickets whose labels change', async () => {
    await tree(['aws']);
    await propagateLabels(1);
    const before = (await db.issues.get(2))!.updatedAt;
    await propagateLabels(1);
    expect((await db.issues.get(2))!.updatedAt).toEqual(before);
  });

  it('stops on a parent loop in damaged data, and does nothing for a missing ticket', async () => {
    await db.issues.bulkAdd([makeIssue({ id: 1, parentId: 2, labels: ['a'] }), makeIssue({ id: 2, parentId: 1, labels: ['b'] })]);
    await expect(propagateLabels(1)).resolves.toBeUndefined();
    await expect(propagateLabels(404)).resolves.toBeUndefined();
  });
});

describe('labelsUnder', () => {
  it('works out the labels of a ticket under a parent, and under none', async () => {
    await db.issues.add(makeIssue({ id: 1, type: 'epic', labels: ['aws'] }));
    expect(await labelsUnder({ labels: ['mine'] }, 1)).toEqual({ labels: ['mine', 'aws'], inheritedLabels: ['aws'] });
    expect(await labelsUnder({ labels: ['mine', 'aws'], inheritedLabels: ['aws'] }, undefined)).toEqual({ labels: ['mine'], inheritedLabels: [] });
    expect(await labelsUnder({ labels: ['mine'] }, 404)).toEqual({ labels: ['mine'], inheritedLabels: [] });
  });
});
