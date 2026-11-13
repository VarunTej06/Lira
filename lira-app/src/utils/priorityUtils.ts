import type { Priority } from '../types/issue';
import { PALETTE } from '../theme/palette';

// The picture for each priority is drawn by PriorityIcon (components/common/Icons.tsx).
interface PriorityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  highest: {
    label: 'Highest',
    color: PALETTE.critical,
    bgColor: PALETTE.criticalBg,
    borderColor: PALETTE.critical,
  },
  high: {
    label: 'High',
    color: PALETTE.danger,
    bgColor: PALETTE.criticalBg,
    borderColor: PALETTE.danger,
  },
  medium: {
    label: 'Medium',
    color: PALETTE.orange,
    bgColor: '#FFF7D6',
    borderColor: PALETTE.orange,
  },
  low: {
    label: 'Low',
    color: PALETTE.success,
    bgColor: '#E3FCEF',
    borderColor: PALETTE.success,
  },
  lowest: {
    label: 'Lowest',
    color: PALETTE.textMuted,
    bgColor: PALETTE.surfaceMuted,
    borderColor: PALETTE.textMuted,
  },
};

export function getPriorityConfig(priority: Priority): PriorityConfig {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
}
