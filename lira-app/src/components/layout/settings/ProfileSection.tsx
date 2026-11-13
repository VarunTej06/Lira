import { CheckCircle2  } from 'lucide-react';
import type { SettingsState } from './useSettingsState';

/** Name, email, initials and role. */
export function ProfileSection(s: SettingsState) {
  const { activeSection, name, setName, email, setEmail, initials, setInitials, role, setRole, profileSaved, handleSaveProfile } = s;
  return (
    <>
          {/* 3. Profile Section */}
          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-lira-text">Personal Profile</h3>
                <p className="text-xs text-lira-muted mt-1">
                  Manage your display name, contact email, initials, and role across your Lira workspace.
                </p>
              </div>

              {/* Avatar Preview */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-lira-border">
                <div className="w-14 h-14 rounded-full bg-[#00875A] text-white font-bold text-xl flex items-center justify-center shadow-xs">
                  {initials || 'VY'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-lira-text">{name}</h4>
                  <p className="text-xs text-lira-muted">{email}</p>
                  <span className="inline-block mt-1 text-3xs font-semibold text-lira-blue bg-lira-blue-light border border-lira-border px-2 py-0.5 rounded-full">
                    {role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-lira-blue focus:border-lira-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-lira-blue focus:border-lira-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Initials (Avatar)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={initials}
                    onChange={e => setInitials(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-lira-blue focus:border-lira-blue transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Job Title / Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-lira-blue focus:border-lira-blue transition-all"
                  />
                </div>
              </div>

              {profileSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Profile saved successfully!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover transition-colors shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}
    </>
  );
}
