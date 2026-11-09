import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from './copyText';


interface Props {
  /** The text to copy, read when the button is pressed. */
  getText: () => string;
  /** Optional formatted version (HTML) so pasting into a document keeps the formatting. */
  getHtml?: () => string | undefined;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export const CopyButton: React.FC<Props> = ({ getText, getHtml, label = 'Copy', className = '', showLabel = true }) => {
  const [done, setDone] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={async e => {
        e.stopPropagation();
        const ok = await copyText(getText(), getHtml?.());
        if (!ok) return;
        setDone(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(false), 1600);
      }}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
      data-testid="copy-button"
      className={`inline-flex items-center gap-1 text-xs cursor-pointer transition-colors ${done ? 'text-emerald-600' : 'text-lira-muted hover:text-lira-blue'} ${className}`}
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {showLabel && <span>{done ? 'Copied' : label}</span>}
    </button>
  );
};
