import { useState } from 'react';

// Reusable detail row
export const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-1.5 w-24 flex-shrink-0 text-xs text-lira-muted mt-1.5">
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
    <div className="flex-1 min-w-0 mt-0.5">{children}</div>
  </div>
);

// Inline label adder
export const LabelAdder: React.FC<{ onAdd: (l: string) => void }> = ({ onAdd }) => {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  if (adding) {
    return (
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); setAdding(false); }
          if (e.key === 'Escape') setAdding(false);
        }}
        onBlur={() => setAdding(false)}
        className="text-xs border border-lira-blue rounded-full px-2 py-0.5 outline-none w-20"
        placeholder="label"
      />
    );
  }
  return (
    <button onClick={() => setAdding(true)} className="px-1.5 py-0.5 text-xs text-lira-muted hover:text-lira-blue border border-dashed border-lira-border hover:border-lira-blue rounded-full transition-colors">
      + Add
    </button>
  );
};
