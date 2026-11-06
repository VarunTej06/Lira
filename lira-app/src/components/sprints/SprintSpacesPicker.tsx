import React from 'react';
import type { Space } from '../../types/space';

interface SprintSpacesPickerProps {
  spaces: Space[];
  /** Selected space ids. An empty list means every space. */
  value: number[];
  onChange: (ids: number[]) => void;
}

/** Which spaces work in a sprint. "All spaces" is the default; untick it to choose a few. */
export const SprintSpacesPicker: React.FC<SprintSpacesPickerProps> = ({ spaces, value, onChange }) => {
  const all = value.length === 0;
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  return (
    <fieldset className="space-y-2">
      <legend className="block text-xs font-semibold text-jira-muted mb-1 uppercase tracking-wide">Spaces in this sprint</legend>
      <label className="flex items-center gap-2 text-sm text-jira-text cursor-pointer">
        <input type="checkbox" checked={all} onChange={() => onChange(all ? spaces.slice(0, 1).map(s => s.id!) : [])} />
        All spaces
      </label>
      {!all && (
        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {spaces.map(s => (
            <label key={s.id} className={`flex items-center gap-2 text-sm rounded-lg border px-2.5 py-1.5 cursor-pointer ${value.includes(s.id!) ? 'border-jira-blue bg-jira-blue-light text-jira-blue' : 'border-jira-border bg-white text-jira-text'}`}>
              <input type="checkbox" checked={value.includes(s.id!)} onChange={() => toggle(s.id!)} />
              <span className="truncate">{s.icon} {s.name}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-jira-muted">
        {all ? 'Every space can add tickets to this sprint.' : value.length === 0 ? '' : `${value.length} of ${spaces.length} spaces. The others stay out until you add them.`}
      </p>
    </fieldset>
  );
};
