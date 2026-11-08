import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'left',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 bg-white rounded-md shadow-dropdown border border-lira-border
            min-w-[160px] py-1 animate-scale-in
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {item.divider && <div className="my-1 border-t border-lira-border" />}
              <button
                className={`
                  w-full text-left px-3 py-2 text-sm flex items-center gap-2
                  hover:bg-gray-50 transition-colors
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-lira-text'}
                `}
                onClick={() => { item.onClick(); setIsOpen(false); }}
              >
                {item.icon && <span className="text-lira-muted">{item.icon}</span>}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

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
