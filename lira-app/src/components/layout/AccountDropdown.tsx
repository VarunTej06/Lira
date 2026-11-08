import { alertDialog } from '../common/dialogs';
import { applyTheme, useSavedTheme, type Theme } from '../../utils/theme';
import React, { useState, useRef, useEffect } from 'react';
import {
  User, Settings, Sun, Moon, Users, LogOut,
  ChevronRight, Check
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export const AccountDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const theme = useSavedTheme();                       // what is applied now
  const [draftTheme, setDraftTheme] = useState<Theme>(theme); // what is selected in the dialog (applied on Save)

  const [userName, setUserName] = useState(() => localStorage.getItem('lira_user_name') || 'Varuntej Yadla');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('lira_user_email') || 'yvaruntej0612@gmail.com');
  const [userInitials, setUserInitials] = useState(() => localStorage.getItem('lira_user_initials') || 'VY');

  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectTheme = (t: Theme) => setDraftTheme(t);
  const closeThemeDialog = () => setShowThemeModal(false);
  const saveTheme = () => { applyTheme(draftTheme); setShowThemeModal(false); };

  const saveProfile = () => {
    const profile = {
      name: userName,
      email: userEmail,
      initials: userInitials,
      role: localStorage.getItem('lira_user_role') || 'MLOps & Platform Engineer',
    };
    localStorage.setItem('lira_user_profile', JSON.stringify(profile));
    localStorage.setItem('lira_user_name', userName);
    localStorage.setItem('lira_user_email', userEmail);
    localStorage.setItem('lira_user_initials', userInitials);
    setShowProfileModal(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Avatar Button Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-white/60 transition-all cursor-pointer ml-1"
        title="Your account"
      >
        <Avatar initials={userInitials} size="sm" color="#00875A" />
      </button>

      {/* Popover matching Account Opions screen.png */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white text-lira-text border border-lira-border rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-150 animate-scale-in">
          {/* Header */}
          <div className="p-4 flex items-center gap-3.5 bg-gray-50/70 border-b border-lira-border">
            <div className="w-12 h-12 rounded-full bg-[#00875A] text-white font-bold text-base flex items-center justify-center flex-shrink-0 shadow-2xs">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-lira-text leading-tight truncate">{userName}</h3>
              <p className="text-xs text-lira-muted truncate mt-0.5">{userEmail}</p>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1 text-sm">
            <button
              onClick={() => { setOpen(false); setShowProfileModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-lira-text transition-colors cursor-pointer text-left"
            >
              <User className="w-4 h-4 text-gray-500" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => { setOpen(false); setShowProfileModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-lira-text transition-colors cursor-pointer text-left"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Account settings</span>
            </button>

            <button
              onClick={() => { setOpen(false); setDraftTheme(theme); setShowThemeModal(true); }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-lira-text transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-purple-600" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>Theme</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-lira-muted">
                <span className="capitalize">{theme}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <div className="border-t border-lira-border my-1" />

            <button
              onClick={() => { setOpen(false); void alertDialog({ title: 'Switch account', message: 'The active user is the only configured local profile (Varuntej Yadla).' }); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-lira-text transition-colors cursor-pointer text-left"
            >
              <Users className="w-4 h-4 text-gray-500" />
              <span>Switch account</span>
            </button>

            <button
              onClick={() => { setOpen(false); void alertDialog({ title: 'Log out', message: 'Offline session: Lira runs on your own computer and needs no cloud login.' }); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-600 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Profile & Account Settings" size="md">
        <div className="p-6 space-y-4 text-lira-text">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-lira-border">
            <div className="w-14 h-14 rounded-full bg-[#00875A] text-white font-bold text-lg flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
            <div>
              <h4 className="font-bold text-lira-text text-base">{userName}</h4>
              <p className="text-xs text-lira-muted">{userEmail}</p>
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Local Workspace Owner
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Full Name</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Email Address</label>
              <input
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-lira-muted uppercase mb-1">Initials</label>
              <input
                type="text"
                value={userInitials}
                maxLength={3}
                onChange={e => setUserInitials(e.target.value.toUpperCase())}
                className="w-24 px-3 py-2 text-sm font-bold border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
            <button
              onClick={() => setShowProfileModal(false)}
              className="px-4 py-2 text-sm text-lira-muted hover:text-lira-text rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              className="px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg hover:bg-blue-700 shadow-xs"
            >
              Save Profile
            </button>
          </div>
        </div>
      </Modal>

      {/* Theme Selector Modal */}
      <Modal isOpen={showThemeModal} onClose={closeThemeDialog} title="Select Appearance Theme" size="sm">
        <div className="p-6 space-y-4 text-lira-text">
          <p className="text-xs text-lira-muted">Choose your preferred visual theme for the Lira workspace interface.</p>
          <div className="space-y-2">
            {[
              { id: 'dark' as const, label: 'Dark theme', desc: 'Dark palette, easy on the eyes', icon: <Moon className="w-4 h-4 text-purple-600" /> },
              { id: 'light' as const, label: 'Light theme', desc: 'Clean, bright layout with white cards', icon: <Sun className="w-4 h-4 text-amber-500" /> },
            ].map(item => (
              <div
                key={item.id}
                onClick={() => selectTheme(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  draftTheme === item.id ? 'border-lira-blue bg-blue-50/50 ring-1 ring-lira-blue' : 'border-lira-border hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">{item.icon}</div>
                  <div>
                    <h5 className="text-sm font-semibold text-lira-text">{item.label}</h5>
                    <p className="text-xs text-lira-muted">{item.desc}</p>
                  </div>
                </div>
                {draftTheme === item.id && <Check className="w-4 h-4 text-lira-blue" />}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
            <button onClick={closeThemeDialog} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
            <button
              onClick={saveTheme}
              className="px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg hover:bg-lira-blue-hover shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
