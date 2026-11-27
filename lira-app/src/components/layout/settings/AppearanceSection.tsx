import { THEMES, type ThemeName } from '../../../theme/palette';
import { PALETTES } from '../../../utils/theme';
import type { SettingsState } from './useSettingsState';

/** A block of one colour from a palette. The colour is data, so it is the one place a style is set. */
function Block({ hex, name, className }: { hex: string; name: string; className: string }) {
  return <span title={name} className={className} style={{ backgroundColor: hex }} />;
}

/** The three colours of a palette side by side as one rectangle, with no gap or line between them. */
function Strip({ of }: { of: ThemeName }) {
  return (
    <span className="flex h-5 w-14 shrink-0 overflow-hidden rounded-sm" aria-hidden>
      {THEMES[of].swatches.map(c => <Block key={c.hex} hex={c.hex} name={c.name} className="flex-1" />)}
    </span>
  );
}

interface OptionProps { selected: boolean; onSelect: () => void; label: string; of: ThemeName }

/** One choice: the colour rectangle and its name beside it. Nothing else. */
function Option({ selected, onSelect, label, of }: OptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2.5 px-2.5 py-2 rounded border text-ui text-lira-text cursor-pointer transition-colors ${
        selected ? 'border-lira-blue bg-lira-blue-light font-bold' : 'border-lira-border hover:border-lira-muted'
      }`}
    >
      <Strip of={of} />
      <span>{label}</span>
    </button>
  );
}

/** Dark or light, then one of that mode's palettes, and under them a short note on what each colour paints. */
export function AppearanceSection(s: SettingsState) {
  const { activeSection, theme, setTheme, palettes, choosePalette, appearanceChanged, handleSaveAppearance, onClose } = s;
  if (activeSection !== 'appearance') return null;
  const chosen = THEMES[palettes[theme]];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-lira-text">Appearance &amp; Theme</h3>
        <p className="text-xs text-lira-muted mt-1">Pick dark or light and a palette, then press Save to apply it.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode">
        <Option selected={theme === 'dark'} onSelect={() => setTheme('dark')} label="Dark" of={palettes.dark} />
        <Option selected={theme === 'light'} onSelect={() => setTheme('light')} label="Light" of={palettes.light} />
      </div>

      <div role="group" aria-labelledby="palette-h" className="space-y-2">
        <h4 id="palette-h" className="text-xs font-bold text-lira-muted uppercase tracking-wider">Choose a {theme} palette</h4>
        <div className="flex flex-wrap gap-2">
          {PALETTES[theme].map(p => <Option key={p} selected={palettes[theme] === p} onSelect={() => choosePalette(p)} label={THEMES[p].label} of={p} />)}
        </div>
      </div>

      <dl aria-label={`What the ${chosen.label} colours are used for`} className="rounded border border-lira-border px-3 py-2.5 space-y-1.5 text-ui">
        {chosen.swatches.map(c => (
          <div key={c.hex} className="flex items-center gap-2.5">
            <dt className="flex items-center gap-2 w-36 shrink-0 font-bold text-lira-text">
              <Block hex={c.hex} name={c.name} className="h-3 w-3 shrink-0 rounded-sm border border-lira-border" />{c.name}
            </dt>
            <dd className="text-lira-muted">{c.use}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-end gap-2 border-t border-lira-border pt-4">
        {appearanceChanged && <span className="text-2xs text-lira-muted mr-auto">Not saved yet</span>}
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
        <button
          onClick={handleSaveAppearance}
          disabled={!appearanceChanged}
          className="px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
