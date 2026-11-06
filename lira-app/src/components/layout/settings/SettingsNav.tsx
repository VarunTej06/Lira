import { Sun, HardDrive, User, Bell, Monitor } from 'lucide-react';
import type { SettingsState } from './useSettingsState';

/** The list of settings pages on the left. */
export function SettingsNav(s: SettingsState) {
  const { activeSection, setActiveSection } = s;
  return (
    <>
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-56 bg-gray-50 border-b md:border-b-0 md:border-r border-jira-border p-3 flex flex-row md:flex-col gap-1 overflow-x-auto flex-shrink-0">
          <div className="hidden md:block px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Workspace Settings
          </div>

          <button
            onClick={() => setActiveSection('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'appearance'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Sun className="w-4 h-4 flex-shrink-0" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveSection('backup')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'backup'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <HardDrive className="w-4 h-4 flex-shrink-0" />
            <span>Export &amp; Backup</span>
          </button>

          <button
            onClick={() => setActiveSection('profile')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'profile'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile</span>
          </button>

          <div className="hidden md:block my-2 border-t border-jira-border" />
          <div className="hidden md:block px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            System
          </div>

          <button
            onClick={() => setActiveSection('general')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'general'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Monitor className="w-4 h-4 flex-shrink-0" />
            <span>General &amp; Locale</span>
          </button>

          <button
            onClick={() => setActiveSection('notifications')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'notifications'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span>Notifications</span>
          </button>
        </div>
    </>
  );
}
