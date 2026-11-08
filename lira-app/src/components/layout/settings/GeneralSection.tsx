import type { SettingsState } from './useSettingsState';

/** Language and time zone. */
export function GeneralSection(s: SettingsState) {
  const { activeSection, language, setLanguage, timeZone, setTimeZone, generalSaved, handleSaveGeneral } = s;
  return (
    <>
          {/* 4. General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-lira-text">General Preferences</h3>
                <p className="text-xs text-lira-muted mt-1">
                  Manage display language, localized timezone, and workspace regional standards.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Display Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="es">Español</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Time Zone</label>
                  <select
                    value={timeZone}
                    onChange={e => setTimeZone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white"
                  >
                    <option value="Asia/Kolkata">(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi</option>
                    <option value="UTC">(GMT+00:00) Coordinated Universal Time</option>
                    <option value="America/New_York">(GMT-05:00) Eastern Time (US &amp; Canada)</option>
                    <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US &amp; Canada)</option>
                    <option value="Europe/London">(GMT+00:00) London, Edinburgh</option>
                  </select>
                </div>
              </div>

              {generalSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium">
                  ✓ General settings saved!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  className="px-5 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Save General Settings
                </button>
              </div>
            </div>
          )}
    </>
  );
}
