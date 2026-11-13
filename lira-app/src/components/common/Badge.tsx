import { STATUS_META } from '../../utils/status';
import React from 'react';
import { PALETTE } from '../../theme/palette';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  label,
  color = PALETTE.textStrong,
  bgColor = PALETTE.border,
  size = 'sm',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-3 py-1 text-xs'
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

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const meta = (STATUS_META as Record<string, { label: string; color: string; bg: string }>)[status];
  const config = meta ? { label: meta.label, color: meta.color, bgColor: meta.bg } : { label: status, color: PALETTE.textStrong, bgColor: PALETTE.border };
  return <Badge label={config.label} color={config.color} bgColor={config.bgColor} size={size} />;
};
