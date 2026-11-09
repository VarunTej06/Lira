import type { Space } from '../../types/space';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { createEpicForItem, ensureTaskForItem, syncEpicFromItem, syncTaskFromItem } from '../../services/roadmapEpics';
import type { ItemSaveOptions } from './itemDraft';
import type { Notice } from './useEnsureEpics';

/**
 * What saving an item does outside the roadmap: create or link its epic, keep the epic and the checklist task in step.
 * Returns the item to store and a notice to show. Throws when the epic cannot be created; nothing is stored then.
 */
export async function prepareItemSave(item: RoadmapItem, opts: ItemSaveOptions, roadmap: Roadmap, space: Space | undefined): Promise<{ item: RoadmapItem; notice: Notice }> {
  let next = item;
  let notice: Notice = null;
  if (opts.epicMode === 'new') {
    if (!space) throw new Error('This roadmap has no space to create the epic in.');
    const key = await createEpicForItem(item, space, roadmap.name);
    next = { ...item, epicKey: key };
    notice = { tone: 'info', text: `Created epic ${key} in ${space.name}. It is in the Backlog.` };
  } else if (opts.epicMode === 'existing' && opts.existingKey) {
    next = { ...item, epicKey: opts.existingKey };
    notice = { tone: 'info', text: `Linked epic ${opts.existingKey}.` };
  }
  if (opts.epicMode !== 'new') await syncEpicFromItem(next, { status: opts.statusChanged });
  // the checklist lives on one task under the epic
  if (next.epicKey && next.children.length > 0) {
    const taskKey = await ensureTaskForItem(next, roadmap.name);
    if (taskKey) { next = { ...next, taskKey }; await syncTaskFromItem(next); }
  } else if (next.taskKey) {
    await syncTaskFromItem(next);
  }
  return { item: next, notice };
}
