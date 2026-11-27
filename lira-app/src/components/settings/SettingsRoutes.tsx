import { Navigate, Route, Routes } from 'react-router-dom';
import { DEFAULT_SETTINGS_PATH } from '../../utils/settingsNav';
import { StandupsPage } from '../standups/StandupsPage';
import { AccountPage, NotificationsPage, SecurityPage } from './AccountPages';
import { AccessPage, ImportPage, TeamDetailPage, TeamsListPage } from './IdentityPages';
import { UsersPage } from './UsersPage';
import { SettingsLayout } from './SettingsLayout';

/** Every Settings page, under /settings. Kept together so the app loads them only when Settings is first opened. */
export function SettingsRoutes() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to={DEFAULT_SETTINGS_PATH} replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UsersPage />} />
        <Route path="teams" element={<TeamsListPage />} />
        <Route path="teams/:teamId" element={<TeamDetailPage />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="calls" element={<StandupsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="*" element={<Navigate to={DEFAULT_SETTINGS_PATH} replace />} />
      </Route>
    </Routes>
  );
}
