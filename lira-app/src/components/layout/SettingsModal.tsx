import React from 'react';
import { useSettingsState, type SettingsModalProps } from './settings/useSettingsState';
import { SettingsNav } from './settings/SettingsNav';
import { AppearanceSection } from './settings/AppearanceSection';
import { BackupSection } from './settings/BackupSection';
import { ProfileSection } from './settings/ProfileSection';
import { GeneralSection } from './settings/GeneralSection';
import { NotificationsSection } from './settings/NotificationsSection';
import { DevicesSection } from './settings/DevicesSection';
import { Check } from 'lucide-react';
import { Modal } from '../common/Modal';
export type { SettingsSection } from './settings/useSettingsState';

/** Lira Settings & Administration: appearance, export & backup, profile, general and notifications. */
export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const s = useSettingsState(props);
  return (
    <Modal isOpen={s.isOpen} onClose={s.onClose} title="Lira Settings & Administration" size="lg">
      <div className="flex flex-col md:flex-row min-h-[480px] max-h-[80vh] overflow-hidden">
        <SettingsNav {...s} />
        {/* Right Section Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <AppearanceSection {...s} />
          <BackupSection {...s} />
          <DevicesSection {...s} />
          <ProfileSection {...s} />
          <GeneralSection {...s} />
          <NotificationsSection {...s} />
        </div>
      </div>
    
      {/* 2-second green toast */}
      {s.bottomToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>{s.bottomToast}</span>
        </div>
      )}
    </Modal>
  );
};
