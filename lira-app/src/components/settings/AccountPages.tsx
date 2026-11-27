import { appStorage } from '../../utils/appStorage';
import { activeOrg, organisations } from '../../utils/hostedOrg';
import { NotificationsSection } from '../layout/settings/NotificationsSection';
import { useSettingsState } from '../layout/settings/useSettingsState';
import { SecurityPanel } from './SecurityPanel';

const Title = ({ children, hint }: { children: string; hint: string }) => <header><h2 className="text-lg font-bold text-lira-text">{children}</h2><p className="text-ui text-lira-muted">{hint}</p></header>;
const noop = () => undefined;

/** Who is signed in and in which workspace. Name and address come from the sign-in; they are changed where the account was made. */
export function AccountPage() {
  const workspace = organisations().find(o => o.orgId === activeOrg());
  const rows: [string, string][] = [
    ['Name', appStorage.get('lira_user_name') ?? ''],
    ['Email', appStorage.get('lira_user_email') ?? ''],
    ['Workspace', workspace?.orgName ?? ''],
    ['Role', workspace?.role ?? ''],
  ];
  return (
    <div className="space-y-5">
      <Title hint="Your sign-in and the workspace you are working in.">Account settings</Title>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-ui">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-lira-muted">{k}</dt><dd>{v || 'Not set'}</dd></div>)}</dl>
    </div>
  );
}

export function SecurityPage() {
  return <div className="space-y-5"><Title hint="Protect your sign-in.">Security</Title><SecurityPanel /></div>;
}

/** The notification choices that already exist in the app settings, shown here as a page. */
export function NotificationsPage() {
  const s = useSettingsState({ isOpen: true, onClose: noop, initialSection: 'notifications' });
  return <NotificationsSection {...s} />;
}
