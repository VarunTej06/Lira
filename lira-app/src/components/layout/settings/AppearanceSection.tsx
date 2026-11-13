import type { ReactNode } from 'react';
import { Moon, Sun, Check } from 'lucide-react';
import { THEMES, type ThemeName } from '../../../theme/palette';
import type { LightPalette } from '../../../utils/theme';
import type { SettingsState } from './useSettingsState';

const LIGHT_PALETTES: LightPalette[] = ['sorrel', 'fawn'];

interface ChoiceCardProps { selected: boolean; onSelect: () => void; title: string; swatchesOf: ThemeName; icon?: ReactNode }

/** One selectable card: a title, what the theme looks like in words, and its three colours. */
function ChoiceCard({ selected, onSelect, title, swatchesOf, icon }: ChoiceCardProps) {
  const theme = THEMES[swatchesOf];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-colors ${
        selected ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-lira-surface hover:border-lira-muted'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-lira-text">{icon}{title}</span>
        {selected && <span className="p-1 rounded-full bg-lira-blue text-lira-on-blue"><Check className="w-3.5 h-3.5" /></span>}
      </span>
      <span className="block text-xs text-lira-muted mt-1">{theme.note}</span>
      <span className="mt-3 flex items-center gap-1.5" aria-hidden>
        {theme.swatches.map(c => (
          <span key={c.hex} title={c.name} className="w-8 h-5 rounded-md border border-lira-border" style={{ backgroundColor: c.hex }} />
        ))}
      </span>
    </button>
  );
}

/** Theme (dark or light) and, for light, which of the two palettes. */
export function AppearanceSection(s: SettingsState) {
  const { activeSection, theme, setTheme, lightPalette, setLightPalette, appearanceChanged, handleSaveAppearance, onClose } = s;
  if (activeSection !== 'appearance') return null;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-lira-text">Appearance &amp; Theme</h3>
        <p className="text-xs text-lira-muted mt-1">Pick a theme, then press Save to apply it. Each theme has its own button colour.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChoiceCard selected={theme === 'dark'} onSelect={() => setTheme('dark')} title="Dark Mode (Default)" swatchesOf="dark" icon={<Moon className="w-4 h-4" />} />
        <ChoiceCard selected={theme === 'light'} onSelect={() => setTheme('light')} title="Light Mode" swatchesOf={lightPalette} icon={<Sun className="w-4 h-4" />} />
      </div>

      {theme === 'light' && (
        <div className="border-t border-lira-border pt-4" role="group" aria-labelledby="light-palette-h">
          <h4 id="light-palette-h" className="text-xs font-bold text-lira-muted uppercase tracking-wider mb-3">Choose a light palette</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LIGHT_PALETTES.map(p => (
              <ChoiceCard key={p} selected={lightPalette === p} onSelect={() => setLightPalette(p)} title={THEMES[p].label} swatchesOf={p} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-lira-border pt-4">
        {appearanceChanged && <span className="text-2xs text-lira-muted mr-auto">Not saved yet</span>}
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
        <button
          onClick={handleSaveAppearance}
          disabled={!appearanceChanged}
          className="px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
