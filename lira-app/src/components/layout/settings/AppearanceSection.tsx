import { Moon, Sun, Check } from 'lucide-react';
import { ACCENTS, DEFAULT_ACCENT, parseHex } from '../../../utils/accent';
import type { SettingsState } from './useSettingsState';

/** Theme and accent colour. */
export function AppearanceSection(s: SettingsState) {
  const { activeSection, accent, chooseAccent, theme, handleSelectTheme } = s;
  return (
    <>
          {/* 1. Appearance Section */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-jira-text">Appearance &amp; Theme</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Customize the look and visual theme of your Lira workspace. Themes apply immediately and are saved with your workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dark Theme Option */}
                <div
                  onClick={() => handleSelectTheme('dark')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === 'dark'
                      ? 'border-jira-blue bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-900 text-amber-300 rounded-lg">
                      <Moon className="w-5 h-5" />
                    </div>
                    {theme === 'dark' && (
                      <span className="p-1 rounded-full bg-jira-blue text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-jira-text">Dark Mode (Default)</h4>
                  <p className="text-xs text-jira-muted mt-1">
                    Deep navy and charcoal tones with high-contrast elements. Comfortable for prolonged engineering sessions.
                  </p>
                  <div className="mt-3 h-8 bg-[#1D2125] rounded-md border border-gray-700 flex items-center px-2.5 gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="w-8 h-2 rounded bg-gray-700" />
                    <span className="w-12 h-2 rounded bg-gray-800" />
                  </div>
                </div>

                {/* Light Theme Option */}
                <div
                  onClick={() => handleSelectTheme('light')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === 'light'
                      ? 'border-jira-blue bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <Sun className="w-5 h-5" />
                    </div>
                    {theme === 'light' && (
                      <span className="p-1 rounded-full bg-jira-blue text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-jira-text">Light Mode</h4>
                  <p className="text-xs text-jira-muted mt-1">
                    Clean, bright Atlassian Jira aesthetic with crisp contrast, white cards, and light blue accents.
                  </p>
                  <div className="mt-3 h-8 bg-gray-100 rounded-md border border-gray-200 flex items-center px-2.5 gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-jira-blue" />
                    <span className="w-8 h-2 rounded bg-gray-300" />
                    <span className="w-12 h-2 rounded bg-gray-200" />
                  </div>
                </div>
              </div>

              {/* Accent Color Section */}
              <div className="border-t border-jira-border pt-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-jira-muted uppercase tracking-wider">Accent Branding</h4>
                  {accent.toUpperCase() !== DEFAULT_ACCENT && (
                    <button onClick={() => chooseAccent(DEFAULT_ACCENT, 'Classic Blue')} className="text-[11px] text-jira-blue hover:underline cursor-pointer">Reset to default</button>
                  )}
                </div>
                <p className="text-xs text-jira-muted mb-3">Used for buttons, active tabs, links and highlights, in both themes. Saved with your other preferences.</p>
                <div className="flex flex-wrap items-center gap-3">
                  {ACCENTS.map(c => {
                    const selected = accent.toUpperCase() === c.hex.toUpperCase();
                    return (
                      <button
                        key={c.hex}
                        onClick={() => chooseAccent(c.hex, c.name)}
                        className={`relative w-8 h-8 rounded-full border-2 shadow-xs hover:scale-110 transition-transform cursor-pointer flex items-center justify-center ${selected ? 'border-white ring-2 ring-offset-2 ring-offset-transparent' : 'border-white/70'}`}
                        style={{ backgroundColor: c.hex, boxShadow: selected ? `0 0 0 2px ${c.hex}` : undefined }}
                        title={c.name}
                        aria-label={`${c.name}${selected ? ' (selected)' : ''}`}
                        aria-pressed={selected}
                      >
                        {selected && <Check className="w-4 h-4 text-white" />}
                      </button>
                    );
                  })}
                  <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-jira-muted flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden" title="Pick any colour">
                    <span className="text-jira-muted text-base leading-none">+</span>
                    <input
                      type="color"
                      value={parseHex(accent) ? accent : DEFAULT_ACCENT}
                      onChange={e => chooseAccent(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label="Pick a custom accent colour"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border border-jira-border">
                  <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-jira-blue hover:bg-jira-blue-hover">Primary button</button>
                  <span className="text-xs font-semibold text-jira-blue">Link</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-jira-blue-light text-jira-blue font-semibold">Badge</span>
                  <span className="text-[11px] text-jira-muted ml-auto">Preview</span>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
