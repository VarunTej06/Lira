import { DatePicker } from '../common/DatePicker';
import { confirmDialog } from '../common/dialogStore';
import React, { useState } from 'react';
import { ExternalLink, Layers, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  STATUS_META, blankRoadmap, duplicateRoadmap, newId, seedLiraRoadmap,
  type MilestoneKind, type Roadmap, type RoadmapItem, type RoadmapMilestone, type RoadmapStatus,
} from '../../utils/roadmapUtils';
import { useResetWhen } from '../../hooks/useResetWhen';
import { buildItemSave, checkItemDraft, type ItemSaveOptions } from './itemDraft';

const input = 'w-full border border-lira-border rounded-lg px-3 py-2 text-sm bg-lira-surface text-lira-text focus:outline-none focus:ring-2 focus:ring-lira-blue/40';
const label = 'block text-xs font-semibold text-lira-muted mb-1';
const primary = 'px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const ghost = 'px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg hover:bg-lira-bg transition-colors cursor-pointer';

// ─── Item (= epic) ───────────────────────────────────────────────────────────

interface ItemModalProps {
  roadmap: Roadmap;
  item: RoadmapItem | null;          // null = closed
  isNew: boolean;
  issues: Issue[];
  space?: Space;
  onSave: (item: RoadmapItem, opts: ItemSaveOptions) => void;
  onDelete: (id: string) => void;
  onOpenEpic: (key: string) => void;
  onClose: () => void;
}

/** Says which epic the item is, or lets the person create or link one. */
function EpicBanner({ draft, set, hasEpic, space, issues, linkable, epicMode, setEpicMode, existingKey, setExistingKey, onOpenEpic }: { draft: RoadmapItem; set: (patch: Partial<RoadmapItem>) => void; hasEpic: boolean; space?: Space; issues: Issue[]; linkable: Issue[]; epicMode: 'new' | 'existing'; setEpicMode: (m: 'new' | 'existing') => void; existingKey: string; setExistingKey: (k: string) => void; onOpenEpic: (key: string) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-violet-300/50 bg-violet-500/10 px-3 py-2.5 text-xs">
      <Layers className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {hasEpic ? (
          <p>This item is the epic <strong>{draft.epicKey}</strong>. Title, description and dates stay in sync with it.</p>
        ) : (
          <>
            <p className="font-semibold mb-1.5">Every roadmap item is an epic.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={epicMode === 'new'} onChange={() => setEpicMode('new')} /> Create a new epic{space ? <> in <strong>{space.name}</strong> (Backlog)</> : ''}</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={epicMode === 'existing'} onChange={() => setEpicMode('existing')} /> Use an existing epic</label>
            </div>
            {!space && epicMode === 'new' && <p className="text-red-500 mt-1">This roadmap has no space. Pick an existing epic, or set a space on the roadmap.</p>}
            {epicMode === 'existing' && (
              <select className={`${input} mt-2`} value={existingKey} onChange={e => {
                setExistingKey(e.target.value);
                const ep = issues.find(i => i.key === e.target.value);
                if (ep && !draft.title.trim()) set({ title: ep.title });
              }}>
                <option value="">Choose an epic…</option>
                {linkable.map(e => <option key={e.id} value={e.key}>{e.key} · {e.title}</option>)}
              </select>
            )}
          </>
        )}
      </div>
      {hasEpic && <button onClick={() => onOpenEpic(draft.epicKey!)} className="flex items-center gap-1 text-violet-600 hover:underline cursor-pointer flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /> Open epic</button>}
    </div>
  );
}

/** Lane, status, dates, owner and progress. */
function DetailsGrid({ draft, set, roadmap, newLane, setNewLane, hasEpic, hasChildren, datesOk }: { draft: RoadmapItem; set: (patch: Partial<RoadmapItem>) => void; roadmap: Roadmap; newLane: string; setNewLane: (s: string) => void; hasEpic: boolean; hasChildren: boolean; datesOk: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={label}>Lane</label>
        <select className={input} value={draft.lane} onChange={e => set({ lane: e.target.value })}>
          {roadmap.lanes.map(l => <option key={l} value={l}>{l}</option>)}
          <option value="__new">+ New lane…</option>
        </select>
        {draft.lane === '__new' && <input className={`${input} mt-2`} placeholder="Lane name" value={newLane} onChange={e => setNewLane(e.target.value)} />}
      </div>
      <div>
        <label className={label}>Status {hasEpic && <span className="font-normal">(follows the epic on the board)</span>}</label>
        <select className={input} value={draft.status} onChange={e => set({ status: e.target.value as RoadmapStatus })}>
          {(Object.keys(STATUS_META) as RoadmapStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Start</label>
        <DatePicker value={draft.start} onChange={v => set({ start: v })} clearable={false} aria-label="Start" />
      </div>
      <div>
        <label className={label}>End</label>
        <DatePicker value={draft.end} onChange={v => set({ end: v })} clearable={false} aria-label="End" />
        {!datesOk && <p className="text-2xs text-red-500 mt-1">End must be on or after the start</p>}
      </div>
      <div>
        <label className={label}>Owner</label>
        <input className={input} value={draft.owner || ''} onChange={e => set({ owner: e.target.value })} placeholder="e.g. VY" />
      </div>
      <div>
        <label className={label}>Progress {hasChildren || hasEpic ? '(from the epic’s tickets, else the checklist)' : `(${draft.progress}%)`}</label>
        <input type="range" min={0} max={100} step={5} disabled={hasChildren} value={draft.progress} onChange={e => set({ progress: Number(e.target.value) })} className="w-full accent-[#0C66E4] disabled:opacity-40" />
      </div>
    </div>
  );
}

/** The checklist of the item: tick, remove and add entries. */
function Checklist({ draft, set, hasChildren, childText, setChildText, addChild, onOpenEpic }: { draft: RoadmapItem; set: (patch: Partial<RoadmapItem>) => void; hasChildren: boolean; childText: string; setChildText: (s: string) => void; addChild: () => void; onOpenEpic: (key: string) => void }) {
  return (
    <div>
      <label className={label}>Checklist {hasChildren && `· ${draft.children.filter(c => c.done).length}/${draft.children.length} done`}</label>
      <p className="text-2xs text-lira-muted mb-1.5">
        {draft.taskKey
          ? <>Saved as the subtasks of one task, <button type="button" onClick={() => onOpenEpic(draft.taskKey!)} className="font-mono text-violet-500 hover:underline cursor-pointer">{draft.taskKey}</button>, under this epic.</>
          : 'Saved as the subtasks of one new task under this epic (created when you save).'}
      </p>
      <div className="space-y-1">
        {draft.children.map(c => (
          <div key={c.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={c.done} onChange={() => set({ children: draft.children.map(x => x.id === c.id ? { ...x, done: !x.done } : x) })} className="w-4 h-4 cursor-pointer" />
            <span className={`flex-1 text-sm ${c.done ? 'line-through text-lira-muted' : ''}`}>{c.title}</span>
            <button onClick={() => set({ children: draft.children.filter(x => x.id !== c.id) })} className="opacity-0 group-hover:opacity-100 text-lira-muted hover:text-red-500 cursor-pointer" aria-label="Remove checklist item"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input className={input} placeholder="Add a checklist item" value={childText} onChange={e => setChildText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChild(); } }} />
        <button onClick={addChild} className="px-3 rounded-lg border border-lira-border text-lira-text hover:bg-lira-bg cursor-pointer" aria-label="Add checklist item"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/** The other items this one must wait for. */
function Dependencies({ draft, set, others }: { draft: RoadmapItem; set: (patch: Partial<RoadmapItem>) => void; others: RoadmapItem[] }) {
  return (
    <div>
      <label className={label}>Depends on (must finish first)</label>
      {others.length === 0 ? <p className="text-xs text-lira-muted">No other items yet.</p> : (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-lira-border divide-y divide-lira-border/60">
          {others.map(o => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-lira-bg/60">
              <input type="checkbox" checked={draft.deps.includes(o.id)} onChange={() => set({ deps: draft.deps.includes(o.id) ? draft.deps.filter(d => d !== o.id) : [...draft.deps, o.id] })} className="w-4 h-4" />
              <span className="flex-1 truncate">{o.title}</span>
              <span className="text-lira-muted">ends {o.end}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Remove (for an existing item), Cancel and Save. */
function ItemFooter({ draft, isNew, valid, onDelete, onClose, save }: { draft: RoadmapItem; isNew: boolean; valid: boolean; onDelete: (id: string) => void; onClose: () => void; save: () => void }) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-lira-border">
      {!isNew ? (
        <button onClick={async () => { if (await confirmDialog({ title: 'Remove from roadmap', message: `Remove "${draft.title}" from the roadmap?${draft.epicKey ? `\n\nThe epic ${draft.epicKey} stays in Lira.` : ''}`, confirmLabel: 'Remove', tone: 'danger' })) onDelete(draft.id); }} className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-500/10 px-3 py-2 rounded-lg cursor-pointer">
          <Trash2 className="w-4 h-4" /> Remove
        </button>
      ) : <span />}
      <div className="flex gap-2">
        <button onClick={onClose} className={ghost}>Cancel</button>
        <button disabled={!valid} onClick={save} className={primary}>{isNew ? 'Add item' : 'Save changes'}</button>
      </div>
    </div>
  );
}

export const ItemModal: React.FC<ItemModalProps> = ({ roadmap, item, isNew, issues, space, onSave, onDelete, onOpenEpic, onClose }) => {
  const [draft, setDraft] = useState<RoadmapItem | null>(item);
  const [newLane, setNewLane] = useState('');
  const [childText, setChildText] = useState('');
  const [epicMode, setEpicMode] = useState<'new' | 'existing'>('new');
  const [existingKey, setExistingKey] = useState('');
  useResetWhen([item], () => { setDraft(item); setNewLane(''); setChildText(''); setEpicMode('new'); setExistingKey(''); });
  if (!draft) return null;

  const set = (patch: Partial<RoadmapItem>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const check = checkItemDraft({ draft, roadmap, issues, space, newLane, epicMode, existingKey });
  const { datesOk, hasEpic, linkable, valid, others, hasChildren } = check;

  const addChild = () => {
    const t = childText.trim();
    if (!t) return;
    set({ children: [...draft.children, { id: newId('c'), title: t, done: false }] });
    setChildText('');
  };

  const save = () => onSave(...buildItemSave({ draft, epicMode, existingKey }, check, item, isNew));

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add roadmap item (epic)' : 'Edit roadmap item'} size="lg">
      <div className="p-6 space-y-4 text-lira-text max-h-[78vh] overflow-y-auto">
        <EpicBanner draft={draft} set={set} hasEpic={hasEpic} space={space} issues={issues} linkable={linkable} epicMode={epicMode} setEpicMode={setEpicMode} existingKey={existingKey} setExistingKey={setExistingKey} onOpenEpic={onOpenEpic} />

        <div>
          <label className={label}>Title</label>
          <input autoFocus className={input} value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="What will be delivered?" />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea className={`${input} min-h-[70px]`} value={draft.description || ''} onChange={e => set({ description: e.target.value })} />
        </div>

        <DetailsGrid draft={draft} set={set} roadmap={roadmap} newLane={newLane} setNewLane={setNewLane} hasEpic={hasEpic} hasChildren={hasChildren} datesOk={datesOk} />

        <Checklist draft={draft} set={set} hasChildren={hasChildren} childText={childText} setChildText={setChildText} addChild={addChild} onOpenEpic={onOpenEpic} />

        <Dependencies draft={draft} set={set} others={others} />

        <ItemFooter draft={draft} isNew={isNew} valid={valid} onDelete={onDelete} onClose={onClose} save={save} />
      </div>
    </Modal>
  );
};

// ─── Milestone ───────────────────────────────────────────────────────────────

interface MilestoneModalProps {
  milestone: RoadmapMilestone | null;
  isNew: boolean;
  onSave: (m: RoadmapMilestone) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({ milestone, isNew, onSave, onDelete, onClose }) => {
  const [draft, setDraft] = useState<RoadmapMilestone | null>(milestone);
  useResetWhen([milestone], () => setDraft(milestone));
  if (!draft) return null;
  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add milestone or release' : 'Edit milestone'} size="sm">
      <div className="p-6 space-y-4 text-lira-text">
        <div><label className={label}>Name</label><input autoFocus className={input} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Date</label><DatePicker value={draft.date} onChange={v => setDraft({ ...draft, date: v })} clearable={false} aria-label="Date" /></div>
          <div>
            <label className={label}>Type</label>
            <select className={input} value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as MilestoneKind })}>
              <option value="milestone">Milestone</option><option value="release">Release</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-lira-border">
          {!isNew ? <button onClick={() => onDelete(draft.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-500/10 px-3 py-2 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /> Delete</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className={ghost}>Cancel</button>
            <button disabled={!draft.title.trim() || !draft.date} onClick={() => onSave({ ...draft, title: draft.title.trim() })} className={primary}>Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ─── New roadmap ─────────────────────────────────────────────────────────────

export const NewRoadmapModal: React.FC<{ spaces: Space[]; onCreate: (rm: Roadmap) => void; onClose: () => void }> = ({ spaces, onCreate, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spaceKey, setSpaceKey] = useState(spaces.find(s => s.key === 'LIRA')?.key || spaces[0]?.key || '');
  const [lanes, setLanes] = useState('Product, Engineering, Design');
  const [template, setTemplate] = useState<'blank' | 'lira'>('blank');

  const create = () => {
    if (template === 'lira') {
      const copy = duplicateRoadmap(seedLiraRoadmap());
      onCreate({ ...copy, name: name.trim(), description: description.trim() || copy.description, spaceKey });
      return;
    }
    onCreate(blankRoadmap({ name, description, spaceKey, lanes: lanes.split(',').map(l => l.trim()).filter(Boolean) }));
  };

  return (
    <Modal isOpen onClose={onClose} title="Create roadmap" size="md">
      <div className="p-6 space-y-4 text-lira-text">
        <div><label className={label}>Name</label><input autoFocus className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 Platform roadmap" /></div>
        <div><label className={label}>Description</label><textarea className={`${input} min-h-[60px]`} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div>
          <label className={label}>Space for the epics</label>
          <select className={input} value={spaceKey} onChange={e => setSpaceKey(e.target.value)}>
            {spaces.map(s => <option key={s.id} value={s.key}>{s.name} ({s.key})</option>)}
          </select>
          <p className="text-2xs text-lira-muted mt-1">Every item on the roadmap becomes an epic in this space, in the Backlog.</p>
        </div>
        <div>
          <label className={label}>Start from</label>
          <div className="grid grid-cols-2 gap-2">
            {([['blank', 'Blank roadmap', 'Your own lanes, no items'], ['lira', 'Lira product roadmap', 'Phases 1–7 from ROADMAP.md']] as const).map(([k, t, d]) => (
              <button key={k} type="button" onClick={() => setTemplate(k)} className={`text-left rounded-xl border px-3 py-2 cursor-pointer transition-colors ${template === k ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border hover:bg-lira-bg'}`}>
                <div className="text-sm font-semibold">{t}</div><div className="text-2xs text-lira-muted">{d}</div>
              </button>
            ))}
          </div>
        </div>
        {template === 'blank' && <div><label className={label}>Lanes (comma separated)</label><input className={input} value={lanes} onChange={e => setLanes(e.target.value)} /></div>}
        <div className="flex justify-end gap-2 pt-3 border-t border-lira-border">
          <button onClick={onClose} className={ghost}>Cancel</button>
          <button disabled={!name.trim() || !spaceKey} onClick={create} className={primary}>Create roadmap</button>
        </div>
      </div>
    </Modal>
  );
};


