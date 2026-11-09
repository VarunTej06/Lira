import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectDropdownProps {
  value: string;
  options: { value: string; label: string; icon?: React.ReactNode; color?: string; bgColor?: string }[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  options,
  onChange,
  className = '',
  placeholder = 'Select...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium border border-transparent hover:border-lira-border hover:bg-gray-50 transition-all w-full"
        style={selected ? { color: selected.color, backgroundColor: selected.bgColor } : {}}
      >
        {selected?.icon}
        <span className="flex-1 text-left">{selected?.label || placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white rounded-md shadow-dropdown border border-lira-border min-w-full py-1 animate-scale-in left-0">
          {options.map(opt => (
            <button
              key={opt.value}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={opt.color ? { color: opt.color, backgroundColor: opt.bgColor } : {}}
              >
                {opt.label}
              </span>
              {value === opt.value && <span className="ml-auto text-lira-blue">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
