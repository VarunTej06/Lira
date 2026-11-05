import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { Space } from '../../types/space';

// ─── 1. General Settings Modal ────────────────────────────────────────────────
export const GeneralSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [language, setLanguage] = useState('en-US');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('lira_locale_prefs', JSON.stringify({ language, timeZone }));
    localStorage.setItem('lira_pref_lang', language);
    localStorage.setItem('lira_pref_tz', timeZone);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="General Personal Settings" size="md">
      <div className="p-6 space-y-5 text-jira-text">
        <p className="text-xs text-jira-muted">
          Manage your personal display preferences, localized timezone, and language.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Display Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white"
            >
              <option value="en-US">English (United States)</option>
              <option value="en-GB">English (United Kingdom)</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Time Zone</label>
            <select
              value={timeZone}
              onChange={e => setTimeZone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white"
            >
              <option value="Asia/Kolkata">(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi</option>
              <option value="UTC">(GMT+00:00) Coordinated Universal Time</option>
              <option value="America/New_York">(GMT-05:00) Eastern Time (US &amp; Canada)</option>
              <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US &amp; Canada)</option>
              <option value="Europe/London">(GMT+00:00) London, Edinburgh</option>
            </select>
          </div>
        </div>

        {saved && (
          <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-medium">
            ✓ Preferences saved successfully!
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Save Preferences
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── 2. Notification Settings Modal ──────────────────────────────────────────
export const NotificationSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [inApp, setInApp] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const prefs = { inApp, sounds, mentionsOnly };
    localStorage.setItem('lira_notification_prefs', JSON.stringify(prefs));
    localStorage.setItem('lira_notif_config', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notification Settings" size="md">
      <div className="p-6 space-y-5 text-jira-text">
        <p className="text-xs text-jira-muted">
          Configure how and when Lira notifies you of work item transitions and team activities.
        </p>

        <div className="space-y-3">
          {[
            { label: 'In-App Live Bell Feed', desc: 'Display updates in the top navigation bell center', state: inApp, set: setInApp },
            { label: 'Sound Alerts', desc: 'Play subtle audio feedback on status transitions', state: sounds, set: setSounds },
            { label: 'Direct Mentions & Assignments Only', desc: 'Only alert when assigned or tagged', state: mentionsOnly, set: setMentionsOnly },
          ].map((item, idx) => (
            <div key={idx} onClick={() => item.set(!item.state)} className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-blue-50/30 rounded-xl border border-jira-border cursor-pointer transition-colors">
              <div>
                <h5 className="text-sm font-semibold text-jira-text">{item.label}</h5>
                <p className="text-xs text-jira-muted">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={item.state}
                onChange={() => {}}
                className="w-4 h-4 text-jira-blue rounded border-gray-300"
              />
            </div>
          ))}
        </div>

        {saved && (
          <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 font-medium">
            ✓ Notification settings updated!
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── 3. Manage Spaces Modal ──────────────────────────────────────────────────
export const ManageSpacesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  onSelectSpace: (id: number) => void;
}> = ({ isOpen, onClose, spaces, onSelectSpace }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Spaces" size="lg">
      <div className="p-6 space-y-4 text-jira-text">
        <p className="text-xs text-jira-muted">
          All spaces active in your local workspace. Each space has its own partitioned JSON file in <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/spaces/</code>.
        </p>

        <div className="divide-y divide-jira-border border border-jira-border rounded-xl overflow-hidden">
          {spaces.map(s => (
            <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-2xs"
                  style={{ backgroundColor: (s.color || '#0052CC') + '22', color: s.color || '#0052CC' }}
                >
                  {s.icon || '📁'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-jira-text">{s.name}</h4>
                  <p className="text-xs text-jira-muted font-mono">Key: {s.key}</p>
                </div>
              </div>
              <button
                onClick={() => { onSelectSpace(s.id!); onClose(); }}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-jira-blue hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                Open Space
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

// ─── 4. Work Items & Hierarchy Modal ──────────────────────────────────────────
export const WorkItemsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Work Item Types & 3-Tier Hierarchy" size="md">
      <div className="p-6 space-y-4 text-jira-text">
        <p className="text-xs text-jira-muted leading-relaxed">
          Lira uses a streamlined 3-tier enterprise hierarchy designed for modern software delivery.
        </p>

        <div className="space-y-3">
          {[
            { type: 'epic' as const, label: 'Epic', icon: '⚡', color: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'Top-level container for large initiatives, themes, or multi-week goals across spaces.' },
            { type: 'task' as const, label: 'Task', icon: '✅', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'Standard engineering work item. Child of an Epic. Can contain subtasks.' },
            { type: 'bug' as const, label: 'Bug', icon: '🐛', color: 'bg-red-100 text-red-800 border-red-200', desc: 'Defect or incident tracking. Sits on the same hierarchy level as Task.' },
            { type: 'subtask' as const, label: 'Subtask', icon: '↳', color: 'bg-gray-100 text-gray-800 border-gray-200', desc: 'Granular step or checklist item belonging directly to a parent Task or Bug.' },
          ].map(item => (
            <div key={item.type} className="p-3.5 rounded-xl border border-jira-border bg-gray-50/60 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${item.color}`}>
                  {item.icon} {item.label}
                </span>
              </div>
              <p className="text-xs text-jira-muted leading-relaxed pt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── 5. Marketplace Apps Modal ───────────────────────────────────────────────
export const MarketplaceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const apps = [
    { name: 'Lira AI Autonomous Agent', status: 'Installed & Active', desc: 'Offline natural language task generator, breakdown, and sprint planner.', icon: '🤖' },
    { name: 'Local PC File Sync Engine', status: 'Active (Vite Plugin)', desc: 'Dual-writes partition data to data/spaces/*.json on your local disk.', icon: '💾' },
    { name: 'Dexie.js IndexedDB Store', status: 'Active (Client DB)', desc: 'Ultra-fast in-browser reactive cache with useLiveQuery observables.', icon: '⚡' },
    { name: 'Claude Model Context Protocol (MCP)', status: 'Connected', desc: 'Model Context Protocol endpoints for seamless external LLM automation.', icon: '🧠' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Installed Apps & Extensions" size="md">
      <div className="p-6 space-y-4 text-jira-text">
        <p className="text-xs text-jira-muted">
          Active integrations, local engines, and agent capabilities in your Lira workspace.
        </p>

        <div className="space-y-3">
          {apps.map((app, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border border-jira-border bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl p-2 rounded-lg bg-gray-50 border border-jira-border">{app.icon}</div>
                <div>
                  <h4 className="text-sm font-bold text-jira-text">{app.name}</h4>
                  <p className="text-xs text-jira-muted mt-0.5">{app.desc}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                {app.status}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── 6. User Management Modal ────────────────────────────────────────────────
export const UserManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const users = [
    { name: 'Varuntej Yadla', initials: 'VY', email: 'yvaruntej0612@gmail.com', role: 'Site Administrator', status: 'Active' },
    { name: 'Lira AI Assistant', initials: 'LA', email: 'ai@lira.local', role: 'Autonomous Agent', status: 'Active' },
    { name: 'Unassigned Queue', initials: 'UN', email: 'unassigned@lira.local', role: 'Service Account', status: 'System' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Management & Access Control" size="lg">
      <div className="p-6 space-y-4 text-jira-text">
        <p className="text-xs text-jira-muted leading-relaxed">
          Manage local users, administrative privileges, and agent service permissions.
        </p>

        <div className="divide-y divide-jira-border border border-jira-border rounded-xl overflow-hidden">
          {users.map(u => (
            <div key={u.email} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0052CC] text-white font-bold text-xs flex items-center justify-center">
                  {u.initials}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-jira-text">{u.name}</h4>
                  <p className="text-xs text-jira-muted">{u.email} · <span className="font-medium text-jira-text">{u.role}</span></p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {u.status}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── 7. Billing & Licensing Modal ────────────────────────────────────────────
export const BillingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Billing & Subscriptions" size="md">
      <div className="p-6 space-y-4 text-jira-text">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-jira-blue">Current Plan</span>
            <span className="text-xs font-bold bg-jira-blue text-white px-2 py-0.5 rounded-full">Free &amp; Open Source</span>
          </div>
          <h3 className="text-lg font-extrabold text-jira-text">Lira Community Edition v2.0</h3>
          <p className="text-xs text-jira-muted">
            Unlimited spaces, unlimited issues, offline local disk sync, Dexie IndexedDB caching, and Lira AI Agent.
          </p>
        </div>

        <div className="space-y-2 text-xs text-jira-muted">
          <div className="flex justify-between py-1.5 border-b border-jira-border">
            <span>License Type</span>
            <span className="font-semibold text-jira-text">MIT / Free Software</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-jira-border">
            <span>Cloud Subscription Fee</span>
            <span className="font-semibold text-emerald-600">$0.00 / month (100% Offline &amp; Local)</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-jira-border">
            <span>Storage Engine</span>
            <span className="font-semibold text-jira-text">Local PC Disk + IndexedDB</span>
          </div>
        </div>

        <div className="flex justify-end border-t border-jira-border pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
