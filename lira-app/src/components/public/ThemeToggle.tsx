import { useState } from 'react';
import { applyTheme, getTheme } from '../../utils/theme';
import { MoonIcon, SunIcon } from './icons';

/** A round icon button: the sun in dark mode (press for light, Sorrel), the moon in light mode (press for dark, Pace). The same choice the app uses. */
export function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => { applyTheme(next); setTheme(next); }}
      className="w-10 h-10 rounded-full flex items-center justify-center text-lira-text bg-gray-100 hover:bg-gray-200 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue">
      {next === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
