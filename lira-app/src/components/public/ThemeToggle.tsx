import { useState } from 'react';
import { applyTheme, getTheme } from '../../utils/theme';
import { MoonIcon, SunIcon } from './icons';

const LOOK = {
  page: 'text-lira-text bg-gray-100 hover:bg-gray-200',
  bar: 'bg-lira-nav border border-white/10 hover:border-white/30 text-white/75 hover:text-white', // beside the bell on the app's dark top bar
} as const;

/** A round icon button: the sun in dark mode (press for light), the moon in light mode (press for dark). The same choice the app uses. */
export function ThemeToggle({ onBar = false }: { onBar?: boolean }) {
  const [theme, setTheme] = useState(getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => { applyTheme(next); setTheme(next); }}
      className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue ${onBar ? LOOK.bar : LOOK.page}`}>
      {next === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
