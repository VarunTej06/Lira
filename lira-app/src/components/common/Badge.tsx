import React from 'react';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = '#172B4D',
  bgColor = '#DFE1E6',
  size = 'sm',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
      style={{ color, backgroundColor: bgColor }}
    >
      {label}
    </span>
  );
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  backlog: { label: 'Backlog', color: '#6B778C', bgColor: '#F4F5F7' },
  todo: { label: 'To Do', color: '#172B4D', bgColor: '#DFE1E6' },
  inprogress: { label: 'In Progress', color: '#0052CC', bgColor: '#DEEBFF' },
  done: { label: 'Done', color: '#006644', bgColor: '#E3FCEF' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || { label: status, color: '#172B4D', bgColor: '#DFE1E6' };
  return <Badge label={config.label} color={config.color} bgColor={config.bgColor} size={size} />;
};
