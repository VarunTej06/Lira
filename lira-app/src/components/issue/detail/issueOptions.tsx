import { TypeIcon, PriorityIcon } from '../../common/Icons';
import type { IssueType } from '../../../types/issue';
import { STATUS_LIST } from '../../../utils/status';
import { PRIORITY_CONFIG } from '../../../utils/priorityUtils';
import { PALETTE } from '../../../theme/palette';

export const STATUS_OPTIONS = STATUS_LIST.map(s => ({ value: s.id as string, label: s.label, color: s.color, bgColor: s.bg }));

export const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { value: 'epic', label: 'Epic', icon: <TypeIcon type="epic" />, color: PALETTE.purple, bgColor: '#EAE6FF' },
  { value: 'task', label: 'Task', icon: <TypeIcon type="task" />, color: PALETTE.brand, bgColor: PALETTE.brandBg },
  { value: 'bug', label: 'Bug', icon: <TypeIcon type="bug" />, color: PALETTE.critical, bgColor: PALETTE.criticalBg },
  { value: 'subtask', label: 'Subtask', icon: <TypeIcon type="subtask" />, color: PALETTE.textMuted, bgColor: PALETTE.surfaceMuted },
];

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: <PriorityIcon priority={value} />,
  color: cfg.color,
  bgColor: cfg.bgColor,
}));

export const ASSIGNEE_OPTIONS = [
  { value: '', label: 'Unassigned', initials: '' },
  { value: 'Varuntej Yadla', label: 'Varuntej Yadla (VY)', initials: 'VY' },
  { value: 'Alex Morgan', label: 'Alex Morgan (AM)', initials: 'AM' },
  { value: 'Sarah Connor', label: 'Sarah Connor (SC)', initials: 'SC' },
  { value: 'Dev Team', label: 'Dev Team (DT)', initials: 'DT' },
];

export const STATUS_BANNER: Record<string, string> = {
  done: PALETTE.success, inprogress: PALETTE.amber, todo: PALETTE.brand, backlog: PALETTE.textMuted,
};

export const STATUS_BUTTON_STYLE: Record<string, { bg: string; text: string; hover: string }> = {
  backlog: { bg: PALETTE.surfaceMuted, text: PALETTE.textMuted, hover: '#E4E6EA' },
  todo: { bg: PALETTE.border, text: PALETTE.textStrong, hover: '#C1C7D0' },
  inprogress: { bg: PALETTE.brandBg, text: PALETTE.brand, hover: '#B3D4FF' },
  done: { bg: '#E3FCEF', text: '#006644', hover: '#ABF5D1' },
};

// Safe accessor helpers
export const safeArr = <T,>(v: T[] | undefined): T[] => Array.isArray(v) ? v : [];
export const toDateInputValue = (val: Date | string | undefined | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // the local day
  } catch {
    return '';
  }
};

