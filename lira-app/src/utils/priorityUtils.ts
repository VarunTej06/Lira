import type { Priority } from '../types/issue';

export interface PriorityConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  highest: {
    label: 'Highest',
    icon: '⏫',
    color: '#DE350B',
    bgColor: '#FFEBE6',
    borderColor: '#DE350B',
  },
  high: {
    label: 'High',
    icon: '🔺',
    color: '#FF5630',
    bgColor: '#FFEBE6',
    borderColor: '#FF5630',
  },
  medium: {
    label: 'Medium',
    icon: '▬',
    color: '#FF991F',
    bgColor: '#FFF7D6',
    borderColor: '#FF991F',
  },
  low: {
    label: 'Low',
    icon: '🔻',
    color: '#36B37E',
    bgColor: '#E3FCEF',
    borderColor: '#36B37E',
  },
  lowest: {
    label: 'Lowest',
    icon: '⏬',
    color: '#6B778C',
    bgColor: '#F4F5F7',
    borderColor: '#6B778C',
  },
};

export function getPriorityConfig(priority: Priority): PriorityConfig {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
}
