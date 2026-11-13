import {  CheckCircle2  } from 'lucide-react';
import type { SettingsState } from './useSettingsState';

/** Notification preferences. */
export function NotificationsSection(s: SettingsState) {
  const { activeSection, notificationPrefs, setNotificationPrefs, notifSaved, handleSaveNotifications } = s;
  return (
    <>
          {/* 5. Notifications Settings */}
          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-lira-text">Notification Channels</h3>
                <p className="text-xs text-lira-muted mt-1">
                  Configure real-time audit notifications and alerts for ticket updates.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'inAppFeed' as const,
                    title: 'In-App Live Bell Feed',
                    desc: 'Display updates in the top navigation bell center',
                  },
                  {
                    key: 'soundFeedback' as const,
                    title: 'Sound Feedback',
                    desc: 'Play subtle audio on ticket transitions',
                  },
                  {
                    key: 'mentionsOnly' as const,
                    title: 'Mentions & Direct Assignments',
                    desc: 'Only highlight tickets when explicitly tagged or assigned',
                  },
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => setNotificationPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                    className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-lira-blue-light/20 rounded-xl border border-lira-border cursor-pointer transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-lira-text">{item.title}</h4>
                      <p className="text-xs text-lira-muted">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs[item.key]}
                      onChange={() => {}}
                      className="w-4 h-4 text-lira-blue rounded border-gray-300 pointer-events-none"
                    />
                  </div>
                ))}
              </div>

              {notifSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Notification preferences saved!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  className="px-5 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover transition-colors shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
    </>
  );
}
