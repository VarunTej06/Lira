import { useState } from 'react';
import { ArrowLeft, Download, Flag, Layers, Map, MoreHorizontal, Plus } from 'lucide-react';
import type { Space } from '../../types/space';
import type { Roadmap } from '../../utils/roadmapUtils';
import { confirmDialog, promptDialog } from '../common/dialogStore';

interface Props {
  roadmap: Roadmap;
  space: Space | undefined;
  spaces: Space[];
  onBack: () => void;
  onChange: (patch: (r: Roadmap) => Roadmap) => void;
  onDelete: () => void;
  onExport: () => void;
  onAddMilestone: () => void;
  onAddItem: () => void;
}

const BUTTON = 'text-xs px-3 py-1.5 border border-lira-border rounded-lg bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer flex items-center gap-1.5';
const MENU_ITEM = 'w-full text-left px-3 py-2 hover:bg-lira-bg cursor-pointer text-lira-text';

/** Where the epics go: the space, or a picker when the roadmap has none yet. */
function SpaceBadge({ space, spaces, onPick }: { space: Space | undefined; spaces: Space[]; onPick: (key: string) => void }) {
  if (space) {
    return <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center gap-1"><Layers className="w-3 h-3" /> Epics in {space.name}</span>;
  }
  return (
    <select
      value=""
      onChange={e => { if (e.target.value) onPick(e.target.value); }}
      className="text-2xs font-semibold px-2 py-1 rounded-full border border-amber-400 bg-amber-500/10 text-amber-600 cursor-pointer"
      aria-label="Choose the space for this roadmap's epics"
    >
      <option value="">Choose a space for the epics…</option>
      {spaces.map(s => <option key={s.id} value={s.key}>{s.name} ({s.key})</option>)}
    </select>
  );
}

/** Rename, edit the description or delete the roadmap. */
function OptionsMenu({ roadmap, onChange, onDelete }: Pick<Props, 'roadmap' | 'onChange' | 'onDelete'>) {
  const [open, setOpen] = useState(false);
  const rename = async () => {
    setOpen(false);
    const name = await promptDialog({ title: 'Rename roadmap', label: 'Name', defaultValue: roadmap.name, confirmLabel: 'Rename' });
    if (name) onChange(r => ({ ...r, name }));
  };
  const describe = async () => {
    setOpen(false);
    const description = await promptDialog({ title: 'Edit description', label: 'Description', defaultValue: roadmap.description || '', required: false, confirmLabel: 'Save' });
    if (description !== null) onChange(r => ({ ...r, description }));
  };
  const remove = async () => {
    setOpen(false);
    if (await confirmDialog({ title: 'Delete roadmap', message: `Delete the roadmap "${roadmap.name}"? Its epics stay in Lira.`, confirmLabel: 'Delete roadmap', tone: 'danger' })) onDelete();
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg border border-lira-border bg-lira-surface text-lira-muted hover:text-lira-text cursor-pointer" aria-label="Roadmap options"><MoreHorizontal className="w-4 h-4" /></button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-lg border border-lira-border bg-lira-surface shadow-dropdown z-40 py-1 text-xs" onMouseLeave={() => setOpen(false)}>
          <button className={MENU_ITEM} onClick={rename}>Rename roadmap</button>
          <button className={MENU_ITEM} onClick={describe}>Edit description</button>
          <button className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 cursor-pointer" onClick={remove}>Delete roadmap</button>
        </div>
      )}
    </div>
  );
}

/** Title, space, description and the action buttons of a roadmap. */
export function RoadmapHeader({ roadmap, space, spaces, onBack, onChange, onDelete, onExport, onAddMilestone, onAddItem }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-lira-muted hover:text-lira-blue cursor-pointer mb-1.5"><ArrowLeft className="w-3.5 h-3.5" /> All roadmaps</button>
        <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2 flex-wrap">
          <Map className="w-5 h-5 text-orange-500" /> {roadmap.name}
          <SpaceBadge space={space} spaces={spaces} onPick={spaceKey => onChange(r => ({ ...r, spaceKey }))} />
        </h1>
        <p className="text-xs text-lira-muted mt-0.5 max-w-3xl">{roadmap.description || 'Plan work over time, track progress and keep dependencies visible.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onExport} className={BUTTON}><Download className="w-3.5 h-3.5" /> Export CSV</button>
        <button onClick={onAddMilestone} className={BUTTON}><Flag className="w-3.5 h-3.5" /> Milestone</button>
        <button onClick={onAddItem} className="text-xs px-3 py-1.5 bg-lira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1.5 font-semibold"><Plus className="w-3.5 h-3.5" /> Add epic</button>
        <OptionsMenu roadmap={roadmap} onChange={onChange} onDelete={onDelete} />
      </div>
    </div>
  );
}
